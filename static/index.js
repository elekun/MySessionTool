const socket = io();

function file_exist_check(filepath){
    let flag;
    $.ajax({url: filepath, dataType: 'html', cache: false, async: false}).done(data => {
        flag = true;
    })
    .fail((jqXHR, textStatus, errorThrown) => {
        flag = false;
    });
    return flag;
}

    
function open_screen_menu(){
    $("#screen_menu").css({"display": "block", "left": event.clientX,"top": event.clientY});
}
function close_screen_menu(){
    $("#screen_menu").css({"display": "none"});
}

let image_type = ""; // background, foreground, common_item, scene_item
function open_image_folder(type){
    $("#image_folder_wrapper").css("display", "flex");
    $("#screen_menu").css({"display": "none"});
    image_type = type;
}
function close_image_folder(){
    $("#image_folder_wrapper").css("display", "none");
}
function open_image_folder_menu(){
    $("#image_folder_menu").css({"display": "block", "left": event.clientX,"top": event.clientY});
}
function close_image_folder_menu (){
    $("#image_folder_menu").css({"display": "none"});
}
function open_image_menu(){
    $("#image_menu").css({"display": "block", "left": event.clientX,"top": event.clientY});
}
function close_image_menu(){
    $("#image_menu").css({"display": "none"});
}

let edited_flag = false;
let now_edit_item_transform = "";
function open_image_edit_window(){
    $("#image_edit_window_wrapper").css({"display": "flex"});
    $("#image_menu").css({"display": "none"});
    
    let item;
    let item_type = $("#image_edit_window").attr("data-item_type");
    if(item_type == "common_item"){
        item = $(`.common_item:eq(${$("#image_edit_window").attr("data-index")})`);
    }
    if(item_type == "scene_item"){
        item = $(`.scene_item:eq(${$("#image_edit_window").attr("data-index")})`);
    }

    now_edit_item_transform = matrix_to_array(item.css("transform"));
    $("#edit_image_info #width").attr("value", parseInt(item.css("width")));
    $("#edit_image_info #height").attr("value", parseInt(item.css("height")));
    $("#edit_image_info #z-index").attr("value", item.css("z-index"));
    $("#edit_image_info #x").attr("value", now_edit_item_transform[0]);
    $("#edit_image_info #y").attr("value", now_edit_item_transform[1]);
    $("#edit_image_info #rotate").attr("value", now_edit_item_transform[2]);
    let fixed = item.attr("data-fixed") == "true";
    let hidden = item.attr("data-hidden") == "true";
    $("#edit_image_switch #fixed input").prop("checked", fixed);
    $("#edit_image_switch #hidden input").prop("checked", hidden);
    edited_flag = true;
}
function close_image_edit_window(){
    if(edited_flag){
        $("#image_edit_window_wrapper").css({"display": "none"});
        let item_type = $("#image_edit_window").attr("data-item_type");
        let data_index = $("#image_edit_window").attr("data-index");
        socket.emit("update_item", 
        {"item_type": item_type, "index": Number(data_index),
            "width": Number($("#edit_image_info #width").val()),
            "height": Number($("#edit_image_info #height").val()),
            "z-index": Number($("#edit_image_info #z-index").val()),
            "x": Number($("#edit_image_info #x").val()),
            "y": Number($("#edit_image_info #y").val()),
            "rotate": Number($("#edit_image_info #rotate").val()),
            "fixed": $("#edit_image_switch #fixed input").prop("checked"),
            "hidden": $("#edit_image_switch #hidden input").prop("checked")
        });
    }
    edited_flag = false;
}


// 画像フォルダの作成・更新（画像アップロード後呼び出し）
function set_image_list () {
    $.getJSON(("/static/room.json"), function(data){
        $("#image_list").empty();
        data.image.forEach(src => {
            let li = $("<li id='image_element'><img/></li>");
            li.children("img").attr("src", src);

            // クリック時の動作
            li.on("mousedown", event => {
                event.preventDefault();
                if(event.which == 1){
                    let img = new Image();
                    img.src = src;
                    if(image_type == "background"){
                        socket.emit("set_background", {"filepath": src});
                    }
                    else if(image_type == "common_item" || image_type == "scene_item"){
                        socket.emit("add_item", {"type": image_type, "filepath": src, "width": img.width, "height": img.height, "z-index": 0, "x": 0, "y": 0, "rotate": 0, "fixed": false, "hidden": false});
                    }
                    close_image_folder();
                }
                else if(event.which == 3){
                    $("#image_folder_menu").off("contextmenu").on("contextmenu", event => {
                        event.preventDefault();
                    });
                    open_image_folder_menu();
                    $("#image_folder_menu").attr("data-filepath", src);
                }
            });
            li.on("contextmenu", event => {
                event.preventDefault();
            });
            $("#image_list").append(li);
        });
    });
}

// サーバーからの送信受け取り処理
$(document).ready(function(){
    // 接続時のクライアント処理
    socket.on('connect', function() {
        set_image_list();
    });

    socket.on('assets_update', function(msg, cb) {
        set_image_list();
    });

    socket.on('window_update', function(msg, cb) {
        // 背景設定
        let bg_path = msg["now_item"]["background"];
        const background = $("#background");
        background.css({"position": "absolute", "inset": "0px", "background-size": "cover","background-position": "50% 50%", "filter": "blur(8px)"
        });
        if(file_exist_check(bg_path) && bg_path != ""){
            background.css({"background-image": `url(${bg_path})`});
        }
        else {
            background.css("background-color", "rgb(64, 64, 64)");
        }
        
        // リセット
        $("#items").empty() 

        // 前景追加
        let fg_path = msg["now_item"]["foreground"] == "" ? bg_path : msg["now_item"]["foreground"];
        const foreground = $("<div id='foreground'></div>");
        foreground.css({"position": "absolute", "z-index": 0, "width": "480px", "height": "270px", "top": "-135px", "left": "-240px", "background-size": "cover"});
        if(file_exist_check(fg_path) && fg_path != ""){
            foreground.css({"background-image": `url(${fg_path})`});
        }
        else {
            foreground.css("background-color", "rgb(56, 56, 56)");
        }
        foreground.mousemove(function(event){event.preventDefault();});
        $("#items").append(foreground);

        // アイテム設定
        let img_list = msg["common_item"].concat(msg["now_item"]["scene_item"]);
        img_list.forEach((data, i) => {
            let item_type = i < msg["common_item"].length ? "common_item" : "scene_item";
            
            let img = new Image();
            img.src = data["filepath"];
            img = $(img);
            img.css({"position": "absolute", "z-index": data["z-index"], "transform": `translate(${data["x"]}px, ${data["y"]}px) rotate(${data["rotate"]}deg)`, "width": data["width"], "height": data["height"]});

            let isFixed = data["fixed"] || data["hidden"];
            // img.css("pointer-events", isFixed ? "none" : "auto");
            img.css("visibility", data["hidden"] ? "hidden" : "visible");

            img.attr({"class": `${item_type} image_item`, "draggable": "false", "data-fixed": data["fixed"], "data-hidden": data["hidden"]});

            img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            $("#items").append(img);
        });

        init_item_data();
    });
});

// $("selector").css("transform")の戻り値をarrayに変換
function matrix_to_array(matrix){
    let values = matrix.split('(')[1];
    values = values.split(')')[0];
    values = values.split(', ');

    let theta = (Math.atan2(Number(values[2]), Number(values[0])) * 180) / Math.PI;
    return [Number(values[4]), Number(values[5]), theta];
}

function init_item_data(){
    // ドラッグでパネルを移動
    const item_list = $(".image_item");
    let item_type_index_list = {"common_item": 0, "scene_item": 0};
    let ignore_index = [];
    item_list.each(function(i, element){
        if($(this).attr("data-fixed") == "true" || $(this).attr("data-hidden") == "true"){
            ignore_index.push(i);
        }
    });
    
    item_list.each(function(i, element){
        let is_drag = false;
        let prevX, prevY;
        let item = $(this);
        let all_img_index = i;
        let item_type = "";
        let data_index = 0;

        if (item.hasClass("common_item")){ item_type = "common_item"; }
        else if (item.hasClass("scene_item")){ item_type = "scene_item"; }
        data_index = item_type_index_list[item_type];
        item_type_index_list[item_type]++;

        item.off("mousedown").on("mousedown", event => {
            if(!ignore_index.includes(all_img_index)){
                is_drag = true;
                item_dd_flag = true;
                prevX = event.clientX;
                prevY = event.clientY;
                item_list.each(pointer_events_toggle(all_img_index, ignore_index));
            }
        });
        item.off("mouseup mouseleave").on("mouseup mouseleave", event => {
            if(is_drag){
                item_list.each(pointer_events_toggle(all_img_index, ignore_index));
                is_drag = false;
                item_dd_flag = false;
                trans_array = matrix_to_array(item.css("transform"));
                socket.emit("update_item", {"item_type": item_type, "index": data_index, "x": trans_array[0], "y": trans_array[1]});
            }
        });
        item.off("mousemove").on("mousemove", event => {
            if (is_drag) {
                let values = item.css("transform").split('(')[1];
                values = values.split(')')[0];
                values = values.split(', ');
                values[4] = Number(values[4]) + (event.clientX - prevX);
                values[5] = Number(values[5]) + (event.clientY - prevY);
                item.css("transform", `matrix(${values[0]}, ${values[1]}, ${values[2]}, ${values[3]}, ${values[4]}, ${values[5]})`);

                prevX = event.clientX;
                prevY = event.clientY;
            }
        });
        item.off("dblclick").on("dblclick", event => {
            $("#image_edit_window").attr({"data-item_type": item_type, "data-index": data_index});
            open_image_edit_window();
        });

        // 右クリックでメニューを開く
        item.off("contextmenu").on("contextmenu", function(event){
            event.preventDefault();
            $("#image_edit_window").attr({"data-item_type": item_type, "data-index": data_index});
            open_image_menu();
            return false;
        });
    });
}
let pointer_events_toggle = function(index, ignore_list) {
    return function(i, element){
        if(i != index || ignore_list.includes(i)){
            let tmp = $(this).css("pointer-events");
            if(tmp == "none"){
                $(this).css("pointer-events", "auto");
            }
            else if(tmp == "auto"){
                $(this).css("pointer-events", "none");
            }
        }
    }
}


let item_dd_flag = false;
// ドラッグで全体の視点移動
function window_move_by_drag(){
    let is_drag = false;
    let prevX, prevY;
    const window_wrapper = $("#window_wrapper");
    window_wrapper.on("mousedown", function(event){
        if(event.which == 1){
            is_drag = !item_dd_flag;
            prevX = event.clientX;
            prevY = event.clientY;
        }
    });
    window_wrapper.on("mouseup mouseleave", function(event){
        is_drag = false;
    });
    window_wrapper.on("mousemove", function(event){
        if (is_drag == true) {
            deltaX = event.clientX - prevX;
            deltaY = event.clientY - prevY;

            let trans_array = matrix_to_array($("#window_zoom").css("transform"));
            $("#window_zoom").css("transform", `translate(${trans_array[0] + deltaX}px, ${trans_array[1] + deltaY}px)`);

            prevX = event.clientX;
            prevY = event.clientY;
        }
    });
}

// 初期化処理
$(function(){
    // ドラッグで全体の視点移動を可能にする
    window_move_by_drag();

    // 右クリックメニュー開閉
    $("#window_wrapper").on("contextmenu", function(event){
        event.preventDefault();
        open_screen_menu();
    });

    // 右クリックメニュー詳細↓↓↓↓

    // 画面右クリック
    // 背景追加
    $("#screen_menu > #ground").on("mousedown", function(event){
        if(event.which == 1){
            open_image_folder("background");
            return false;
        }
    });
    // 共通アイテム追加
    $("#screen_menu > #common").on("mousedown", function(event){
        if(event.which == 1){
            open_image_folder("common_item");
            return false;
        }
    });
    // シーンアイテム追加
    $("#screen_menu > #scene").on("mousedown", function(event){
        if(event.which == 1){
            open_image_folder("scene_item");
            return false;
        }
    });

    // 画像右クリック
    $("#image_menu > #edit").on("mousedown", function(event){
        if(event.which == 1){
            open_image_edit_window();
            return false;
        }
    });

    // 画像フォルダ
    $("#image_folder_footer").on("mousedown", function(event){
        if(event.which == 1){
            close_image_folder();
            return false;
        }
    });
});



$(function(){
    // 画像アップロード(ドラッグアンドドロップ)
    const input_zone = $("#input_zone");
    input_zone.on("dragover", event => {
        event.preventDefault();
    });
    input_zone.on("drop", event => {
        event.preventDefault();
        let file = event.originalEvent.dataTransfer.files[0];
        socket.emit("upload", {"file": file, "name": file.name});
    });

    // 画像消去
    $("#image_folder_menu #delete").on("mousedown", event => {
        if(event.which == 1){
            socket.emit("delete_img", {"filepath": $("#image_folder_menu").attr("data-filepath")});
            close_image_folder_menu();
            return false;
        }
    });

    // 画像設定

});


// 範囲外左クリックでメニューを閉じる
$(document).on("mousedown", function(event){
    if(event.which == 1){
        if(!$(event.target).closest($("#screen_menu")).length){
            event.stopPropagation();
            close_screen_menu();
        }
        if(!$(event.target).closest($("#image_folder")).length){
            event.stopPropagation();
            close_image_folder();
        }
        if(!$(event.target).closest($("#image_folder_menu")).length){
            event.stopPropagation();
            close_image_folder_menu();
        }
        if(!$(event.target).closest($("#image_menu")).length){
            event.stopPropagation();
            close_image_menu();
        }
        if(!$(event.target).closest($("#image_edit_window")).length){
            event.stopPropagation();
            close_image_edit_window();
        }
    }
});