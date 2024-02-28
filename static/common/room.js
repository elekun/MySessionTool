const socket = io();
const color_list = ["#ff0000", "#008000", "#0000ff", "#ffff00", "#800080", "#ffa500", "#696969", "#ff00ff", "#4169e1", "#adff2f", "#c0c0c0", "#d2691e", "#6a5acd", "#ff7f50", "#00ffff", "#006400", "#b22222", "#4b0082", "#ffd700", "#ffffff"];
let zoom_ratio = 1.0;

let user_id = "";
let user_name = "";
let user_type = "";

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
function get_roomid(){
    let roomid = $("#get_roomid").attr("data-roomid");
    return roomid.slice(1, roomid.length - 1);   
}

function open_login_window(){
    $(".out_click_close").css({"display": "none"});
    $("#login_window_wrapper").css("display", "flex");
    //$("#login_window").css({"display": "none"});
    $("#register_window").css({"display": "none"});
}

function open_screen_menu(){
    $("#screen_menu").css({"display": "block", "left": event.clientX,"top": event.clientY});
}

let image_type = ""; // background, foreground, common_item, scene_item, character_item
let select_type = ""; // add, update
function open_image_folder(it, st, id = ""){
    $(".out_click_close").css({"display": "none"});
    $("#image_folder").css("display", "flex");
    $("#image_folder_wrapper").css("display", "flex");
    $("#image_folder").attr("data-id", id);
    image_type = it;
    select_type = st;
}
// 画像フォルダの作成・更新（画像アップロード後呼び出し）
function set_image_list () {
    $.getJSON((`/static/room/${get_roomid()}/room.json`), function(data){
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
                    const item_type = image_type;
                    if(select_type == "add"){
                        if(item_type == "common_item" || item_type == "scene_item"){
                            socket.emit("add_item", {"roomid" : get_roomid(),"item_type": item_type, "filepath": src, "text": "", "width": img.width, "height": img.height, "z-index": 0, "x": 0, "y": 0, "rotate": 0, "fixed": false, "hidden": false});
                        }
                    }
                    else if(select_type == "update"){
                        if(item_type == "background"){
                            socket.emit("set_background", {"roomid" : get_roomid(),"filepath": src});
                        }
                        else if(item_type == "common_item" || item_type == "scene_item"){
                            socket.emit("update_item", {"roomid" : get_roomid(),"item_type": item_type, "filepath": src});
                        }
                        else if(item_type == "character_item"){
                            $("#character_edit_window #character_icon img").attr("src", src);
                            $("#character_edit_window #character_icon img").attr("data-path", src);
                        }
                    }
                    $("#image_folder_wrapper").css("display", "none");
                    event.stopPropagation();
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
function open_image_folder_menu(){
    $("#image_folder_menu").css({"display": "block", "left": event.clientX,"top": event.clientY});
}
function open_image_menu(menu, x, y){
    $("#" + menu).css({"display": "block", "left": x,"top": y});


    if(menu == "stock_menu"){
        $("#stock_menu > li").removeClass("disable");
        if($("#stock_menu").attr("num") == 0){
            $("#stock_menu > #draw, #stock_menu > #open").addClass("disable");
        }
    }
    if(menu == "card_menu"){
        let text = "裏にする";
        if($("#card_menu").attr("data-back") == "true"){
            text = "表にする";
        }
        $("#card_menu > #turn").text(text);
    }
}

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
}
function close_image_edit_window(){
    let item_type = $("#image_edit_window").attr("data-item_type");
    let data_index = $("#image_edit_window").attr("data-index");
    if(item_type){
        socket.emit("update_item", 
        {"roomid" : get_roomid(), "item_type": item_type, "index": Number(data_index),
            "width": Number($("#edit_image_info #width").val()),
            "height": Number($("#edit_image_info #height").val()),
            "z-index": Number($("#edit_image_info #z-index").val()),
            "x": Number($("#edit_image_info #x").val()),
            "y": Number($("#edit_image_info #y").val()),
            "rotate": Number($("#edit_image_info #rotate").val()),
            "fixed": $("#edit_image_switch #fixed input").prop("checked") == "true",
            "hidden": $("#edit_image_switch #hidden input").prop("checked") == "true"
        });
    }
}

function toggle_hand_area(){
    if($("#hand_area").hasClass("hand_area_open")){
        $("#hand_area").removeClass("hand_area_open");
    }
    else {
        $("#hand_area").addClass("hand_area_open");
    }
}
function open_hand_menu(){
    let height = $("#hand_menu").height();
    $("#hand_menu").css({"display": "block", "left": event.clientX,"top": event.clientY - height});
}

function set_character_list (data) {
    for (let [id, character] of Object.entries(data)) {
        if(character["user_id"] == user_id){
            let elem = $(`<li data-id=${id} data-hidden=${character["hidden"]}></li>`);
            const img_path = character["img"] == "" ? "/static/common/img/defalut_character.png" : character["img"];
            const name = character["name"] == "" ? "NO NAME" : character["name"];
            elem.append(`
                <div class="icon"><img src=${img_path}/></div>
                <div class="name">${name}</div>
                <div class="toggle">${character["hidden"] ? "＋" : "－"}</div>
            `);
            elem.on("mouseenter", function(event){
                $(this).css("background-color", "#ffffff40");
            });
            elem.on("mouseleave", function(event){
                $(this).css("background-color", "#ffffff00");
            });
            elem.on("mousedown", function(event){
                if(event.which == 1){
                    open_character_edit_window($(this).attr("data-id"));
                }
                event.stopPropagation();
            });
            elem.children(".toggle").on("mouseenter", function(event){
                $(this).parent().css("background-color", "#ffffff00");
            });
            elem.children(".toggle").on("mouseleave", function(event){
                $(this).parent().css("background-color", "#ffffff40");
            });
            elem.children(".toggle").on("mousedown", function(event){
                if(event.which == 1){
                    character["hidden"] = !character["hidden"];
                    socket.emit("update_item", {"roomid" : get_roomid(), "item_type": "character_item", "id": id, "hidden": character["hidden"]});
                    $(this).text(character["hidden"]? "＋" : "－");
                }
                event.stopPropagation();
            });
            $("#character_list ul").append(elem);
        }
    }
}

function set_common_item_list() {
    $("#common_item_list ul").empty();
    $.getJSON((`/static/room/${get_roomid()}/room.json`), function(data){
        data["common_item"].forEach((common, index) => {
            let elem = $(`<li data-index=${index} data-hidden=${common["hidden"]}></li>`);
            const img_path = common["filepath"] == "" ? "/static/common/img/defalut_character.png" : common["filepath"];
            const text = common["text"] == "" ? "NO TEXT" : common["text"];
            elem.append(`
                <div class="icon"><img src=${img_path}/></div>
                <div class="text">${text}</div>
                <div class="toggle">${common["hidden"] ? "＋" : "－"}</div>
            `);
            elem.on("mouseenter", function(event){
                $(this).css("background-color", "#ffffff40");
            });
            elem.on("mouseleave", function(event){
                $(this).css("background-color", "#ffffff00");
            });
            elem.on("mousedown", function(event){
                if(event.which == 1){
                    $("#image_edit_window").attr({"data-item_type": "common_item", "data-index": index});
                    open_image_edit_window();
                }
                event.stopPropagation();
            });
            elem.children(".toggle").on("mouseenter", function(event){
                $(this).parent().css("background-color", "#ffffff00");
            });
            elem.children(".toggle").on("mouseleave", function(event){
                $(this).parent().css("background-color", "#ffffff40");
            });
            elem.children(".toggle").on("mousedown", function(event){
                if(event.which == 1){
                    common["hidden"] = !common["hidden"];
                    socket.emit("update_item", {"roomid" : get_roomid(), "item_type": "common_item", "index": index, "hidden": common["hidden"]});
                    $(this).text(common["hidden"] == "true" ? "＋" : "－");
                }
                event.stopPropagation();
            });
            $("#common_item_list ul").append(elem);
        });
    });
}

function set_scene_item_list() {
    $("#scene_item_list ul").empty();
    $.getJSON((`/static/room/${get_roomid()}/room.json`), function(data){
        data["now_item"]["scene_item"].forEach((scene, index) => {
            let elem = $(`<li data-index=${index} data-hidden=${scene["hidden"]}></li>`);
            const img_path = scene["filepath"] == "" ? "/static/common/img/defalut_character.png" : scene["filepath"];
            const text = scene["text"] == "" ? "NO TEXT" : scene["text"];
            elem.append(`
                <div class="icon"><img src=${img_path}/></div>
                <div class="text">${text}</div>
                <div class="toggle">${scene["hidden"] ? "＋" : "－"}</div>
            `);
            elem.on("mouseenter", function(event){
                $(this).css("background-color", "#ffffff40");
            });
            elem.on("mouseleave", function(event){
                $(this).css("background-color", "#ffffff00");
            });
            elem.on("mousedown", function(event){
                if(event.which == 1){
                    $("#image_edit_window").attr({"data-item_type": "scene_item", "data-index": index});
                    open_image_edit_window();
                }
                event.stopPropagation();
            });
            elem.children(".toggle").on("mouseenter", function(event){
                $(this).parent().css("background-color", "#ffffff00");
            });
            elem.children(".toggle").on("mouseleave", function(event){
                $(this).parent().css("background-color", "#ffffff40");
            });
            elem.children(".toggle").on("mousedown", function(event){
                if(event.which == 1){
                    scene["hidden"] = !scene["hidden"];
                    socket.emit("update_item", {"roomid" : get_roomid(), "item_type": "scene_item", "index": index, "hidden": scene["hidden"]});
                    $(this).text(scene["hidden"] == "true" ? "＋" : "－");
                }
                event.stopPropagation();
            });
            $("#scene_item_list ul").append(elem);
        });
    });
}

function open_character_edit_window(id){
    $("#character_edit_window").attr("data-id", id);
    $.getJSON((`/static/room/${get_roomid()}/room.json`), function(data){
        let character = data["character_item"][id];
        let elem = $("#character_edit_window_content");

        const img_path = character["img"] == "" ? "/static/common/img/defalut_character.png" : character["img"];
        elem.find("#character_icon img").attr("src", img_path);
        elem.find("#character_icon img").attr("data-path", character["img"]);
        elem.find("#input_name").attr("value", character["name"]);
        elem.find("#input_initiative").attr("value", parseInt(character["initiative"]));
        elem.find("#character_memo").text(character["text"]);
        elem.find("#input_scale").attr("value", Number(character["scale"]));
        elem.find("#input_x").attr("value", parseInt(character["x"]));
        elem.find("#input_y").attr("value", parseInt(character["y"]));

        elem.find("#character_status_list").empty();
        character["status"].forEach(function(status, i) {
            elem.find("#character_status_list").append(`
                <li>
                <div>
                    <label for="input_status_label_${i}">ラベル</label>
                    <input type="text" id="input_status_label_${i}" value=${status["label"]}>
                </div>
                <div>
                    <label for="input_status_value_${i}">現在値</label>
                    <input type="number" id="input_status_value_${i}" value=${Number(status["value"])}>
                </div>
                <div>
                    <label for="input_status_max_${i}">最大値</label>
                    <input type="number" id="input_status_max_${i}" value=${Number(status["max"])}>
                </div>
                </li>
            `);
        });
        elem.find("#character_param_list").empty();
        character["params"].forEach(function(param, i) {
            elem.find("#character_param_list").append(`
                <li>
                <div>
                    <label for="input_param_label_${i}">ラベル</label>
                    <input type="text" id="input_param_label_${i}" value=${param["label"]}>
                </div>
                <div>
                    <label for="input_param_max_${i}">値</label>
                    <input type="text" id="input_param_max_${i}" value=${Number(param["value"])}>
                </div>
                </li>
            `);
        });
        elem.find("#character_command_area").text(character["commands"]);

        let status_hidden = character["status_hidden"] == "true";
        let icon_hidden = character["icon_hidden"] == "true";
        $("#character_switch #status_hidden input").prop("checked", status_hidden);
        $("#character_switch #icon_hidden input").prop("checked", icon_hidden);
    });

    $("#character_info #character_icon").off("mousedown").on("mousedown", function(event){
        open_image_folder("character_item", "update", id);
        event.stopPropagation();
    });

    $("#character_status .add_button").off("mousedown").on("mousedown", function(event) {
        const i = $("#character_status_list").length;
        $("#character_status_list").append(`
            <li>
            <div>
                <label for="input_status_label_${i}">ラベル</label>
                <input type="text" id="input_status_label_${i}" value=""}>
            </div>
            <div>
                <label for="input_status_value_${i}">現在値</label>
                <input type="number" id="input_status_value_${i}" value=${0}>
            </div>
            <div>
                <label for="input_status_max_${i}">最大値</label>
                <input type="number" id="input_status_max_${i}" value=${0}>
            </div>
            </li>
        `);
    });
    $("#character_status .subtract_button").off("mousedown").on("mousedown", function(event) {
        $("#character_status_list li:last-child").remove();
    });

    $("#character_param .add_button").off("mousedown").on("mousedown", function(event) {
        const i = $("#character_param_list").length;
        $("#character_param_list").append(`
            <li>
            <div>
                <label for="input_param_label_${i}">ラベル</label>
                <input type="text" id="input_param_label_${i}" value="">
            </div>
            <div>
                <label for="input_param_max_${i}">値</label>
                <input type="text" id="input_param_max_${i}" value="">
            </div>
            </li>
        `);
    });
    $("#character_param .subtract_button").off("mousedown").on("mousedown", function(event) {
        $("#character_param_list li:last-child").remove();
    });
    

    $("#character_edit_window_wrapper").css({"display": "flex"});
}
function close_character_edit_window(){
    const id = $("#character_edit_window").attr("data-id");
    const path = $("#character_edit_window_content #character_icon img").attr("data-path");
    const status = $("#character_edit_window_content #character_status_list li").map((index, data) =>{
        return {
            "label": $(data).find("div:nth-child(1) input").val(),
            "value": parseInt($(data).find("div:nth-child(2) input").val()),
            "max": parseInt($(data).find("div:nth-child(3) input").val())
        };
    });
    const params = $("#character_edit_window_content #character_param_list li").map((index, data) =>{
        return {
            "label": $(data).find("div:nth-child(1) input").val(),
            "value": $(data).find("div:nth-child(2) input").val()
        };
    });
    socket.emit("update_item", 
    {"roomid" : get_roomid(), "item_type": "character_item", "id": id,
        "img": path,
        "name": $("#character_edit_window_content #input_name").val(),
        "initiative": Number($("#character_edit_window_content #input_initiative").val()),
        "text": $("#character_edit_window_content #character_memo").val(),
        "scale": Number($("#character_edit_window_content #input_scale").val()),
        "x": Number($("#character_edit_window_content #input_x").val()),
        "y": Number($("#character_edit_window_content #input_y").val()),
        "status": status,
        "params": params,
        "commands": $("#character_edit_window_content #character_command_area").val(),
        "status_hidden": $("#character_switch #status_hidden input").prop("checked") == "true",
        "icon_hidden": $("#character_switch #icon_hidden input").prop("checked") == "true"
    });
}

// サーバーからの送信受け取り処理
$(document).ready(function(){
    // 接続時のクライアント処理
    socket.on('connect', function() {
        let cookie = $.cookie();
        if ("user_id" in cookie) {
            user_id = cookie["user_id"];
        }

        if ("zoom_ratio" in cookie){
            zoom_ratio = Number(cookie["zoom_ratio"]);
            $("#window_zoom").css("transform", `scale(${zoom_ratio})`);
        }
        else {
            $.cookie("zoom_ratio", 1.0);
        }
        socket.emit("join_process", {"roomid" : get_roomid(), "user_id": user_id});
    });

    socket.on("set_user_info", function(msg, cb){
        user_id = msg["user_id"];
        user_name = msg["user_name"];
        user_type = msg["user_type"];
        if(msg["new_guest"] == "true"){
            $.cookie("user_id", user_id, { expires: 7 }); // 1 weeks
        }
        socket.emit("init_window", {"roomid" : get_roomid(), "user_id": user_id});
        socket.emit("init_list", {"roomid" : get_roomid(), "user_id": user_id});
    });

    socket.on('assets_update', function(msg, cb) {
        set_image_list();
    });

    socket.on('window_update', function(msg, cb) {
        set_image_list();

        // 背景設定
        let bg_path = msg["now_item"]["background"];
        const background = $("#background");
        background.css({"position": "absolute", "inset": "0px", "background-size": "cover","background-position": "50% 50%", "filter": "blur(8px)", "margin": "-8px"
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

            img.css("display", data["hidden"] ? "none" : "auto");

            img.attr({"class": `${item_type} image_item`, "draggable": "false", "data-fixed": data["fixed"], "data-hidden": data["hidden"]});

            img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            $("#items").append(img);
        });

        //カード周り
        let deck_list = msg["deck_item"]
        get_color = (index) => { return index < 20 ? color_list[index] : "#000000" };

        let i = 0;
        for (let [id, data] of Object.entries(deck_list)) {
            // 山札
            let stock_img = new Image();
            stock_img.src = data["back"];
            stock_img = $(stock_img);
            stock_img.css({"position": "absolute", "width": data["width"], "height": data["height"]});
            if(data["stock"].length == 0){
                stock_img.css({"filter": "brightness(0.5)"});
            }

            let stock_div = $("<div></div>");
            stock_div.css({"position": "absolute", "z-index": 1000, "transform": `translate(${data["stock_x"]}px, ${data["stock_y"]}px)`, "width": data["width"], "height": data["height"], "border": `5px solid #00000000`, "background-color": `${get_color(i)}80`, "display": "flex", "justify-content": "center", "align-items": "center"});
            stock_div.attr({"class": `stock_pile_item image_item`, "draggable": "false", "data-id": id, "data-name": data["name"], "num":data["stock"].length});
            if(data["stock"].length == 0){
                stock_div.css({"filter": "brightness(0.5)"});
            }


            stock_img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            stock_div.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            stock_div.append(stock_img)
            stock_div.append($(`<div></div>`).css({"position": "absolute", "width": "80px", "height": "calc(1em + 16px)", "background-color": "#00000080", "border-radius": "16px"}));
            stock_div.append($(`<div>残り${data["stock"].length}</div>`).css({"position": "absolute", "width": "100%", "height": "100%", "display": "flex", "justify-content": "center", "align-items": "center", "color": "#f0f0f0"}));
            $("#items").append(stock_div);

            // 捨て札
            let discard_img = new Image();
            if(data["discard"].length == 0){
                discard_img = $(discard_img);
            }
            else {
                let top = data["contents"].filter(d => d["cardid"] == data["discard"].slice(-1)[0])[0];
                discard_path = top["path"];
                discard_img.src = discard_path;
                discard_img = $(discard_img);
            }
            discard_img.css({"position": "absolute", "width": data["width"], "height": data["height"]});
            
            let discard_div = $("<div></div>");

            discard_div.css({"position": "absolute", "z-index": 1000, "transform": `translate(${data["discard_x"]}px, ${data["discard_y"]}px)`, "width": data["width"], "height": data["height"], "border": `5px solid #00000000`, "background-color": `${get_color(i)}80`, "display": "flex", "justify-content": "center", "align-items": "center"});

            discard_div.attr({"class": `discard_pile_item image_item`, "draggable": "false", "data-id": id, "data-name": data["name"], "num":data["discard"].length});

            discard_img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            discard_div.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            discard_div.append(discard_img);
            discard_div.append($(`<div></div>`).css({"position": "absolute", "width": "80px", "height": "calc(1em + 16px)", "background-color": "#00000080", "border-radius": "16px"}));
            discard_div.append($(`<div>残り${data["discard"].length}</div>`).css({"position": "absolute", "width": "100%", "height": "100%", "display": "flex", "justify-content": "center", "align-items": "center", "color": "#f0f0f0"}));
            $("#items").append(discard_div);

            i++;
        }

        // 場のカード
        let card_list = msg["card_item"];
        card_list.forEach((data, i) => {
            let deck = msg["deck_item"][data["deckid"]];
            card = deck["contents"][data["cardid"]]

            let img = new Image();
            img.src = data["is_back"] ? deck["back"] : card["path"];
            img = $(img);
            img.css({"border": `5px solid #00000000`, "background-color": `${get_color(data["deckid"])}80`});

            img.css({"position": "absolute", "z-index": 1000, "transform": `translate(${data["x"]}px, ${data["y"]}px)`, "width": deck["width"], "height": deck["height"]});

            img.attr({"class": `card_item image_item`, "draggable": "false", "data-id": data["deckid"], "data-cardid": data["cardid"], "data-name": card["name"], "data-back": data["is_back"]});

            img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            $("#items").append(img);
        });

        // キャラクター
        let character_list = msg["character_item"];
        for (let [id, character] of Object.entries(character_list)) {
            let img = new Image();
            img.src = character["img"] != "" ? character["img"] : "/static/common/img/defalut_character.png";
            img = $(img);
            if(character["img"] == ""){
                img.css({"background-color": "rgb(44, 44, 44)"});
            }
            img.attr({"draggable": "false"});

            let div = $(`<div></div>`);
            div.css("display", character["hidden"] == "true" ? "none" : "auto");
            div.css({"position": "absolute", "z-index": 1000, "transform": `translate(${character["x"]}px, ${character["y"]}px) scale(${Number(character["scale"]) / 100})`});
            
            div.attr({"class": `character_item image_item`, "draggable": "false", "data-id": id, "data-text": character["text"]});

            img.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });
            div.on('mousedown mouseover drop drag dragover', function(event){ event.preventDefault(); });

            div.append(img);
            let name = $(`<span>${character["name"]}</span>`);
            div.append(name);
            $("#items").append(div);
        }

        init_item_data();
    });

    socket.on('hand_update', function(msg, cb) {
        $("#hand_area > #cards").empty();
        msg["hand"].forEach(card => {
            let img = new Image();
            img.src = card["path"];
            img = $(img);
            img.css({"width": "80px", "height": "120px", "margin": "4px", "border": "2px solid rgba(0, 0, 0, 0)", "background-color": `${color_list[Number(card["deckid"])]}80`});
            img.attr({"data-id": card["deckid"], "data-cardid": card["cardid"]});

            img.on("mousedown", function(event){
                if(event.which == 1){
                    if(!$(this).hasClass("selected_card")){
                        $("#hand_area #cards *").removeClass("selected_card");
                        $(this).addClass("selected_card");
                    }
                    else if($(this).hasClass("selected_card")){
                        const id = $(this).attr("data-id");
                        const cardid= Number($(this).attr("data-cardid"));
                        socket.emit("discard_fromhand", {"roomid" : get_roomid(), "deckid": id, "cardid": cardid, "user_id": user_id});
                    }
                }
            });
            img.on("contextmenu", function(event){
                event.preventDefault();
                $("#hand_menu").attr({"data-id": img.attr("data-id"), "data-cardid": img.attr("data-cardid")});
                open_hand_menu();
            });

            $("#hand_area > #cards").append(img)
        });
    });

    socket.on('character_list_update', function(msg, cb) {
        $("#character_list ul").empty();
        set_character_list(msg);
    });
    socket.on('common_item_list_update', function(msg, cb) {
        set_common_item_list();
    });
    socket.on('scene_item_list_update', function(msg, cb) {
        set_scene_item_list();
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
        let prevX, prevY, startX, startY;
        let item = $(this);
        let all_img_index = i;
        let item_type = "";
        let data_index = 0;

        const type_list = ["common_item", "scene_item", "stock_pile_item", "discard_pile_item", "card_item", "character_item"];
        type_list.forEach(e => {
            if (item.hasClass(e)) {item_type = e}
        })

        data_index = item_type_index_list[item_type];
        item_type_index_list[item_type]++;
        $(this).attr("data-index", data_index);

        item.off("mousedown").on("mousedown", event => {
            if(event.which == 1 && !ignore_index.includes(all_img_index)){
                is_drag = true;
                item_dd_flag = true;
                prevX = event.clientX;
                prevY = event.clientY;
                let trans_array = matrix_to_array(item.css("transform"));
                startX = trans_array[0]
                startY = trans_array[1]
                item_list.each(pointer_events_toggle(all_img_index, ignore_index));
            }
        });
        item.off("mouseup mouseleave").on("mouseup mouseleave", event => {
            let trans_array = matrix_to_array(item.css("transform"));

            if(is_drag){
                item_list.each(pointer_events_toggle(all_img_index, ignore_index));
                is_drag = false;
                item_dd_flag = false;

                const data = {"roomid" : get_roomid(),"item_type": item_type, "x": Math.trunc(trans_array[0]), "y": Math.trunc(trans_array[1])}
                if(startX != trans_array[0] || startY != trans_array[1]){
                    if(item_type == "common_item" || item_type == "scene_item"){
                        socket.emit("update_item", Object.assign(data, {"index": data_index}));
                    }
                    else if(item_type == "stock_pile_item" || item_type == "discard_pile_item") {
                        socket.emit("update_item", Object.assign(data, {"deckid": item.attr("data-id")}));
                    }
                    else if(item_type == "card_item") {
                        socket.emit("update_item", Object.assign(data, {"deckid": item.attr("data-id"), "cardid": Number(item.attr("data-cardid"))}));
                    }
                    else if(item_type == "character_item") {
                        socket.emit("update_item", Object.assign(data, {"id": item.attr("data-id")}));
                    }
                }

            }
        });
        item.off("mousemove").on("mousemove", event => {
            if (is_drag) {
                let values = item.css("transform").split('(')[1];
                values = values.split(')')[0];
                values = values.split(', ');
                values[4] = Number(values[4]) + (event.clientX - prevX) / zoom_ratio;
                values[5] = Number(values[5]) + (event.clientY - prevY) / zoom_ratio;
                item.css("transform", `matrix(${values[0]}, ${values[1]}, ${values[2]}, ${values[3]}, ${values[4]}, ${values[5]})`);

                prevX = event.clientX;
                prevY = event.clientY;
            }
        });
        item.off("dblclick").on("dblclick", event => {
            if(item_type == "common_item" || item_type == "scene_item"){
                $("#image_edit_window").attr({"data-item_type": item_type, "data-index": data_index});
                open_image_edit_window();
            }
            if(item_type == "character_item"){
                open_character_edit_window(item.attr("data-id"));
            }
            event.stopPropagation();
        });

        // 右クリックでメニューを開く
        item.off("contextmenu").on("contextmenu", function(event){
            event.preventDefault();
            let menu = "";
            if(item_type == "common_item" || item_type == "scene_item"){
                menu = "image_menu"
                $("#image_edit_window").attr({"data-item_type": item_type, "data-index": data_index});
            }
            else if(item_type == "stock_pile_item") {
                menu = "stock_menu"
                $("#stock_menu").attr({"data-id": item.attr("data-id"), "num": item.attr("num")});
            }
            else if(item_type == "discard_pile_item") {
                menu = "discard_menu"
                $("#discard_menu").attr({"data-id": item.attr("data-id"), "num": item.attr("num")});
            }
            else if(item_type == "card_item") {
                menu = "card_menu"
                $("#card_menu").attr({"data-id": item.attr("data-id"), "data-cardid": item.attr("data-cardid"), "data-back": item.attr("data-back")});
            }
            else if(item_type == "character_item") {
                menu = "character_menu"
                $("#character_menu").attr({"data-id": item.attr("data-id")});
            }
            open_image_menu(menu, event.clientX, event.clientY);
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
            $("#window_zoom").css("transform", `translate(${trans_array[0] + deltaX}px, ${trans_array[1] + deltaY}px) scale(${zoom_ratio})`);

            prevX = event.clientX;
            prevY = event.clientY;
        }
    });
}

// 初期化処理
$(function(){
    // ドラッグで全体の視点移動を可能にする
    window_move_by_drag();
    // マウスホイールで拡大縮小
    let mousewheelevent = 'onwheel' in document ? 'wheel' : 'onmousewheel' in document ? 'mousewheel' : 'DOMMouseScroll';
    $("#screen").on(mousewheelevent, function(event){
        event.preventDefault();
        let delta = event.originalEvent.deltaY ? -(event.originalEvent.deltaY) : event.originalEvent.wheelDelta ? event.originalEvent.wheelDelta : -(event.originalEvent.detail);
        zoom_ratio += delta > 0 ? 0.1 : -0.1;
        zoom_ratio = Math.round(zoom_ratio * 10) / 10;
        zoom_ratio = zoom_ratio > 2.0 ? 2.0 : (zoom_ratio < 0.2 ? 0.2 : zoom_ratio);
        $.removeCookie('zoom_ratio');
        $.cookie("zoom_ratio", zoom_ratio);

        let trans_array = matrix_to_array($("#window_zoom").css("transform"));
        $("#window_zoom").css("transform", `translate(${trans_array[0]}px, ${trans_array[1]}px) scale(${zoom_ratio})`);
    });

    // ヘッダのアイコン
    $(".screen_header_button").on("mousedown", function(event){
        const obj = {
            "character_list_toggle" : {"id": "character_list", "title": "キャラクター一覧"}, 
            "common_item_list_toggle" : {"id": "common_item_list", "title": "共通アイテム一覧"},
            "scene_item_list_toggle" : {"id": "scene_item_list", "title": "シーンアイテム一覧"}, 
            "deck_item_list_toggle" : {"id": "deck_item_list", "title": "デッキアイテム一覧"},
            "scene_list_toggle" : {"id": "scene_list", "title": "シーン一覧"}
        };
        const this_id = $(this).attr("id");
        if(event.which == 1){
            let window_id = "#" + obj[this_id]["id"];
            if(!$("#draggable_window_list").has(window_id).length){
                let item_list = $(`<div id="${obj[this_id]["id"]}" class="draggable_window"></div>`);
                let header = $(`<div class="draggable_window_header"></div>`);
                let title = $(`<span>${obj[this_id]["title"]}</span>`);
                let add_item_button = $(`<div class="add_item_button">＋</div>`);
                let close_button = $(`<div class="close_draggable_window">×</div>`);
                close_button.on("mousedown", function(event){
                    $(window_id).remove();
                });
                header.append(title, $("<div></div>").append(add_item_button, close_button));
                item_list.append(header);

                let list = $("<ul></ul>");
                item_list.append(list);
    
                if(this_id == "character_list_toggle"){
                    $.getJSON((`/static/room/${get_roomid()}/room.json`), function(data){
                        set_character_list(data["character_item"]);
                    });
                    add_item_button.on("mousedown", function(event){
                        socket.emit("add_character", {"roomid": get_roomid(), "user_id": user_id});
                    });
                }
                else if(this_id == "common_item_list_toggle"){
                    set_common_item_list();
                    add_item_button.on("mousedown", function(event){
                        if(event.which == 1){
                            open_image_folder("common_item", "add");
                            return false;
                        }
                    });
                }
                else if(this_id == "scene_item_list_toggle"){
                    set_scene_item_list();
                    add_item_button.on("mousedown", function(event){
                        if(event.which == 1){
                            open_image_folder("scene_item", "add");
                            return false;
                        }
                    });
                }

                $("#draggable_window_list").append(item_list);


                // ドラッグ処理
                $(".draggable_window_header").each(function(i, element){
                    is_drag = false;
                    let start_pos, mouse_x, mouse_y;
                    $(this).off("mousedown").on("mousedown", event => {
                        if(event.which == 1){
                            is_drag = true;
                            start_pos = $(this).parent().position();
                            mouse_x = event.clientX;
                            mouse_y = event.clientY;
                        }
                    });
                    $(this).off("mouseup mouseleave").on("mouseup mouseleave", event => {
                        if(is_drag){
                            is_drag = false;
                        }
                    });
                    $(this).off("mousemove").on("mousemove", event => {
                        if (is_drag) {
                            $(this).parent().css({"left": (start_pos.left + event.clientX - mouse_x) + "px", "top": (start_pos.top + event.clientY - mouse_y) + "px"});
                        }
                    });
                });
            }
            else {
                $(window_id).remove();
            }
        }
        event.preventDefault();
    });

    $("#user_info").on("click", function(event){
        $("#user_info_menu").css({"display": "flex", "left": event.clientX,"top": event.clientY});
        if(user_type == "guest"){
            $("#user_name").text("ゲスト");
            $("#logout_button").css("display", "none");
        }
        else {
            $("#user_name").text(user_name);
            $("#login_button").css("display", "none");
        }
        $("#user_id").text(user_id);
        event.preventDefault();
    });
    $("#user_info_menu #login_button").on("mousedown", function(event){
        if(event.which == 1){
            open_login_window();
            return false;
        }
    });
    $("#user_info > #logout_button").on("mousedown", function(event){
        if(event.which == 1){
            // 処理
            return false;
        }
    });

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
            open_image_folder("background", "update");
            event.stopPropagation();
        }
    });
    // 共通アイテム追加
    $("#screen_menu > #common").on("mousedown", function(event){
        if(event.which == 1){
            open_image_folder("common_item", "add");
            event.stopPropagation();
        }
    });
    // シーンアイテム追加
    $("#screen_menu > #scene").on("mousedown", function(event){
        if(event.which == 1){
            open_image_folder("scene_item", "add");
            event.stopPropagation();
        }
    });

    // トランプ追加
    $("#screen_menu > #playingcard").on("mousedown", function(event){
        if(event.which == 1){
            socket.emit("add_default_deck", {"roomid" : get_roomid()});
            $(".out_click_close").css({"display": "none"});
            event.stopPropagation();
        }
    });

    // 共通アイテム・シーンアイテム編集
    $("#image_menu > #edit").on("mousedown", function(event){
        if(event.which == 1){
            open_image_edit_window();
            event.stopPropagation();
        }
    });
    
    $("#character_menu > #edit").on("mousedown", function(event){
        if(event.which == 1){
            open_character_edit_window($("#character_menu").attr("data-id"));
            event.stopPropagation();
        }
    });

    // キャラクター編集

    //山札・捨て札・場札の右クリックメニュー
    (function(){
        const stock_menu = $("#stock_menu");
        stock_menu.children().on("mousedown", function(event){ 
            const deckid = stock_menu.attr("data-id");
            const elem_id = $(this).attr("id");
            if(event.which == 1){
                if(elem_id == "draw"){
                    socket.emit("draw_card", {"roomid" : get_roomid(), "deckid": deckid, "user_id": user_id});
                }
                if(elem_id == "open" || elem_id == "open_back"){
                    let is_back = elem_id == "open" ? false : true;
                    socket.emit("open_card", {"roomid" : get_roomid(), "deckid": deckid, "is_back": is_back});
                }
                if(elem_id == "shuffle"){
                    socket.emit("shuffle_card", {"roomid" : get_roomid(), "deckid": deckid});
                }
                if(elem_id == "gather"){
                    socket.emit("gather_card", {"roomid" : get_roomid(), "deckid": deckid, "user_id": user_id});
                }
                $(".out_click_close").css({"display": "none"});
                return false;
            }
        });
        const discard_menu = $("#discard_menu");
        discard_menu.children().on("mousedown", function(event){ 
            const deckid = discard_menu.attr("data-id");
            const elem_id = $(this).attr("id");
            if(event.which == 1){
                if(elem_id == "return_top" || elem_id == "return_bottom"){
                    let type = elem_id === "return_top" ? "top" : "bottom";
                    socket.emit("return_card", {"roomid" : get_roomid(), "deckid": deckid, "type": type});
                }
                $(".out_click_close").css({"display": "none"});
                return false;
            }
        });
        const card_menu = $("#card_menu");
        card_menu.children().on("mousedown", function(event){ 
            const deckid = card_menu.attr("data-id");
            const cardid= Number(card_menu.attr("data-cardid"));
            const elem_id = $(this).attr("id");
            if(event.which == 1){
                if(elem_id == "turn"){
                    const is_back = $("#card_menu").attr("data-back") == "true";
                    socket.emit("update_item", {"roomid" : get_roomid(), "item_type": "card_item", "deckid": deckid, "cardid": cardid, "is_back": !is_back});
                }
                if(elem_id == "discard"){
                    socket.emit("discard_fromcard", {"roomid" : get_roomid(), "deckid": deckid, "cardid": cardid});
                }
                $(".out_click_close").css({"display": "none"});
                return false;
            }
        });
    }());

    // 画像フォルダ
    $("#image_folder_footer").on("mousedown", function(event){
        if(event.which == 1){
            event.stopPropagation();
            $("#image_folder_wrapper").css({"display": "none"});
        }
    });

    // 手札表示部分・手札右クリックメニュー
    (function(){
        // 手札表示部分
        $("#hand_area_toggle").on("mousedown", function(event){
            if(event.which == 1){
                toggle_hand_area();
                event.stopPropagation();
            }
        });

        // 手札右クリックメニュー
        const hand_menu = $("#hand_menu");
        hand_menu.children().on("mousedown", function(event){
            const deckid = hand_menu.attr("data-id");
            const cardid = Number(hand_menu.attr("data-cardid"));
            const elem_id = $(this).attr("id");
            if(event.which == 1){
                if(elem_id == "discard"){
                    socket.emit("discard_fromhand", {"roomid" : get_roomid(), "deckid": deckid, "cardid": cardid, "user_id": user_id});
                }
                if(elem_id == "open" || elem_id == "open_back"){
                    let is_back = elem_id == "open" ? false : true;
                    socket.emit("open_fromhand", {"roomid" : get_roomid(), "deckid": deckid, "cardid": cardid, "user_id": user_id, "is_back": is_back});
                }
                $(".out_click_close").css({"display": "none"});
                return false;
            }
        });
    }());
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
        socket.emit("upload", {"roomid" : get_roomid(),"file": file, "name": file.name});
    });

    // 画像消去
    $("#image_folder_menu #delete").on("mousedown", event => {
        if(event.which == 1){
            socket.emit("delete_img", {"roomid" : get_roomid(), "filepath": $("#image_folder_menu").attr("data-filepath")});
            $("#image_folder_menu").css({"display": "none"});
            return false;
        }
    });

    // 画像設定

});


// 範囲外左クリックでメニューを閉じる
$(document).on("mousedown", function(event){
    if(event.which == 1){
        if(!$(event.target).closest($("#image_edit_window")).length){
            if($("#image_edit_window_wrapper").css("display") != "none"){
                close_image_edit_window();
            }
            event.stopPropagation();
        }
        if(!$(event.target).closest($("#character_edit_window")).length){
            if($("#character_edit_window_wrapper").css("display") != "none"){
                close_character_edit_window();
            }
            event.stopPropagation();
        }
        if (!$(event.target).closest($(".out_click_close")).length){
            $(".out_click_close").css({"display": "none"});
            event.stopPropagation();
        }
        if (!$(event.target).closest($(".out_click_parent_close")).length){
            let flag = true;
            $($(".out_click_parent_close").get().reverse()).each(function(i, element){
                if($(element).parent().css("display") != "none" && flag){
                    $(element).parent().css({"display": "none"});
                    flag = false;
                }
            });
            event.stopPropagation();
        }
        if(!$(event.target).closest($("#hand_area #cards *")).length){
            $("#hand_area #cards *").removeClass("selected_card");
        }
    }
});

// ログイン・アカウント登録
$(function(){
    
});