from threading import Lock
from flask import Flask, render_template, session, request, \
    copy_current_request_context
from flask_socketio import SocketIO, emit, join_room, leave_room, \
    close_room, rooms, disconnect

import os
from PIL import Image
import io
import json
import random
import string
import datetime

from util import make_deck, make_playingcard_deck

# Set this variable to "threading", "eventlet" or "gevent" to test the
# different async modes, or leave it set to None for the application to choose
# the best option based on installed packages.
async_mode = None

app = Flask(__name__)
app.config['SECRET_KEY'] = "secret key"
socketio = SocketIO(app, async_mode=async_mode, max_http_buffer_size=50*1024*1024)
thread = None
thread_lock = Lock()

guest_list = []

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

@app.route('/room/<roomid>', methods=['GET', 'POST'])
def room(roomid):
    return render_template('room.html', roomid=roomid, async_mode=socketio.async_mode)

@socketio.event
def join_process(message):
    join_room(message['roomid'])

    user_id = message["user_id"]
    user_type = "guest"
    user_name = "ゲスト"
    is_new_guest = False
    with open(os.path.join(f"./static/common", "user.json"), 'r', encoding="utf-8") as f:
        user_list = json.load(f)
    if message["user_id"] in user_list["user"]:
        user_name = user_list["user"][message["user_id"]]
        user_type = "user"
    elif message["user_id"] not in user_list["guest"]:
        guest_id = ''.join(random.choices(string.ascii_letters + string.digits, k=3))
        while guest_id in user_list["guest"]:
            guest_id = ''.join(random.choices(string.ascii_letters + string.digits, k=3))
        user_id = "guest-" + guest_id
        dt = datetime.datetime.now()
        user_list["guest"][user_id] = dt.strftime('%Y/%m/%d %H:%M:%S')
        is_new_guest = True
    with open(os.path.join(f"./static/common", "user.json"), 'w', encoding="utf-8") as f:
        json.dump(user_list, f, indent=4, ensure_ascii=False)

    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        if user_id not in d["players"]:
            d["players"][user_id] = {"hand": [], "character": []}
    if message["user_id"] in d["room_master"]:
        user_type = "room_master"
        
    save_room_json(message["roomid"], d)

    emit("set_user_info", {"user_id": user_id, "user_name": user_name, "user_type": user_type, "new_guest" : "true" if is_new_guest else "false"})

@socketio.event
def upload(message):
    buf = io.BytesIO(message["file"])
    img = Image.open(buf)
    img.save(os.path.join(f"./static/room/{message["roomid"]}/img/", message["name"]))
    
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        if message["name"] not in d["image"]:
            path = os.path.join(f"/static/room/{message["roomid"]}/img/", message["name"])
            d["image"].append(path)
        else:
            print("\n\n same name file exists \n\n")

    save_room_json(message["roomid"], d)
    emit('assets_update')

@socketio.event
def delete_img(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        d["image"].remove(message["filepath"])
        os.remove("." + message["filepath"])

    save_room_json(message["roomid"], d)
    emit('assets_update')

@socketio.event
def update_ground(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        for k in ["background", "foreground", "width", "height"]:
            if k == "background" or k == "foreground":
                if k in message:
                    d["now_item"][k] = message[k]
            elif k == "width" or k == "height":
                if k in message:
                    d["now_item"]["fore_" + k] = message[k]

    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])


@socketio.event
def add_item(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        if message["item_type"] == "common_item":
            d["common_item"].append(message)
        elif message["item_type"] == "scene_item":
            d["now_item"]["scene_item"].append(message)

    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def delete_item(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        if message["item_type"] == "common_item":
            del d["common_item"][message["index"]]
        elif message["item_type"] == "scene_item":
            del d["now_item"]["scene_item"][message["index"]]
        
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def add_character(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        character_id = 0
        while str(character_id) in d["character_item"]:
            character_id += 1
        d["character_item"][str(character_id)] = {
            "user_id": message["user_id"],
            "img": "",
            "x": 0, "y": 0, "scale": 1.0,
            "name": "", "initiative" : 0,
            "text": "", "commands": "",
            "status": [
                {"label": "HP", "value": 0, "max": 0}
            ],
            "params": [
                {"label": "", "value": 0}
            ],
            "hidden" : True, "status_hidden": False, "icon_hidden": False
        }
    save_room_json(message["roomid"], d)
    emit('character_list_update', d["character_item"])

@socketio.event
def update_item(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        flag = False
        item = {}
        # common or scene
        cors = {"common_item": d["common_item"], "scene_item": d["now_item"]["scene_item"]}
        for k, v in cors.items():
            if message["item_type"] != k:
                continue

            item = v[message["index"]]
            for k in ["filepath", "text", "width", "height", "z-index", "x", "y", "rotate", "fixed", "hidden"]:
                if k in message:
                    if item[k] != message[k]:
                        flag = True
                        item[k] = message[k]
            break
        
        sord = {"stock_pile_item": "stock", "discard_pile_item": "discard"}
        for k, v in sord.items():
            if message["item_type"] != k:
                continue

            item = d["deck_item"][message["deckid"]]
            if item[v + "_x"] != message["x"] or item[v + "_y"] != message["y"]:
                item[v + "_x"] = message["x"]
                item[v + "_y"] = message["y"]
                flag = True

            break

        if message["item_type"] == "card_item":
            for card in d["card_item"]:
                if card["deckid"] == message["deckid"] and card["cardid"] == message["cardid"]:
                    item = card

            for k in ["x", "y", "is_back"]:
                if k in message:
                    if item[k] != message[k]:
                        flag = True
                        item[k] = message[k]

        if message["item_type"] == "character_item":
            if "status" in message:
                del message["status"]["length"], message["status"]["prevObject"]
                message["status"] = list(message["status"].values())
            if "params" in message:
                del message["params"]["length"], message["params"]["prevObject"]
                message["params"] = list(message["params"].values())

            item = d["character_item"][message["id"]]
            for k in ["img", "x", "y", "scale", "name", "initiative", "text", "commands", "status", "params", "hidden", "status_hidden", "icon_hidden"]:
                if k in message:
                    if item[k] != message[k]:
                        flag = True
                        item[k] = message[k]

        if flag:
            save_room_json(message["roomid"], d)
            emit('window_update', d, to=message["roomid"])
            if message["item_type"] == "common_item":
                emit('common_item_list_update')
            if message["item_type"] == "scene_item":
                emit('scene_item_list_update')
            if message["item_type"] == "character_item":
                emit('character_list_update', d["character_item"])

@socketio.event
def init_window(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
    emit('window_update', d, to=message["roomid"])

    hand = []
    for card in d["players"][message["user_id"]]["hand"]:
        hand.append({"deckid": card["deckid"], "cardid": card["cardid"], "path": d["deck_item"][card["deckid"]]["contents"][card["cardid"]]["path"]})
    emit("hand_update", {"hand": hand})

@socketio.event
def add_default_deck(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        id = len(d["deck_item"])
        deck_id, deck = make_playingcard_deck(id)
        d["deck_item"][deck_id] = deck

    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])


@socketio.event
def draw_card(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        user_id = message["user_id"]
        deck = d["deck_item"][message["deckid"]]

        d["players"][user_id]["hand"].append({"deckid": message["deckid"], "cardid": deck["stock"].pop(0)})

    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

    hand = []
    for card in d["players"][user_id]["hand"]:
        hand.append({"deckid": card["deckid"], "cardid": card["cardid"], "path": d["deck_item"][card["deckid"]]["contents"][card["cardid"]]["path"]})
    emit("hand_update", {"hand": hand})

@socketio.event
def open_card(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        deck = d["deck_item"][message["deckid"]]
        d["card_item"].append({"deckid": message["deckid"], "cardid": deck["stock"].pop(0), "x": 0, "y": 0, "is_back": message["is_back"]})
      
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def shuffle_card(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        random.shuffle(d["deck_item"][message["deckid"]]["stock"])
      
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def gather_card(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        deck = d["deck_item"][message["deckid"]]
        for value in d["players"].values():
            deck["stock"].extend([card["cardid"] for card in value["hand"] if card["deckid"] == message["deckid"]])
            value["hand"] = [card for card in value["hand"] if card["deckid"] != message["deckid"]]

      
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])
    
    hand = []
    for card in d["players"][message["user_id"]]["hand"]:
        hand.append({"deckid": card["deckid"], "cardid": card["cardid"], "path": d["deck_item"][card["deckid"]]["contents"][card["cardid"]]["path"]})
    emit("hand_update", {"hand": hand})

@socketio.event
def discard_fromcard(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        deck = d["deck_item"][message["deckid"]]
        deck["discard"].append(message["cardid"])
        d["card_item"] = [card for card in d["card_item"] if card["deckid"] != message["deckid"] or card["cardid"] != message["cardid"]]
    
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def discard_fromhand(message):
    print(message)
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        deck = d["deck_item"][message["deckid"]]
        deck["discard"].append(message["cardid"])
        d["players"][message["user_id"]]["hand"].remove({"deckid": message["deckid"], "cardid": message["cardid"]})
    
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

    hand = []
    for card in d["players"][message["user_id"]]["hand"]:
        hand.append({"deckid": card["deckid"], "cardid": card["cardid"], "path": d["deck_item"][card["deckid"]]["contents"][card["cardid"]]["path"]})
    emit("hand_update", {"hand": hand})

@socketio.event
def open_fromhand(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        d["card_item"].append({"deckid": message["deckid"], "cardid": message["cardid"], "x": 0, "y": 0, "is_back": message["is_back"]})
        d["players"][message["user_id"]]["hand"].remove({"deckid": message["deckid"], "cardid": message["cardid"]})
      
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

    hand = []
    for card in d["players"][message["user_id"]]["hand"]:
        hand.append({"deckid": card["deckid"], "cardid": card["cardid"], "path": d["deck_item"][card["deckid"]]["contents"][card["cardid"]]["path"]})
    emit("hand_update", {"hand": hand})


@socketio.event
def return_card(message):
    with open(get_room_json(message["roomid"]), 'r', encoding="utf-8") as f:
        d = json.load(f)
        deck = d["deck_item"][message["deckid"]]

        if message["type"] == "top":
            deck["stock"] = deck["discard"] + deck["stock"]
            deck["discard"].clear()
        elif message["type"] == "bottom":
            deck["stock"] = deck["stock"] + deck["discard"]
            deck["discard"].clear()
    
    save_room_json(message["roomid"], d)
    emit('window_update', d, to=message["roomid"])

@socketio.event
def connect():
    pass

def get_room_json(roomid):
    path = os.path.join(f"./static/room/{roomid}", "room.json")
    return path

def save_room_json(roomid, data):
    with open(get_room_json(roomid), 'w', encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)



if __name__ == '__main__':

    # ゲストデータ処理
    # 1週間で消す
    with open(os.path.join(f"./static/common", "user.json"), 'r', encoding="utf-8") as f:
        d = json.load(f)
        now = datetime.datetime.now()
        remain_data = {}
        for k, v in d["guest"].items():
            last = datetime.datetime.strptime(v, '%Y/%m/%d %H:%M:%S')
            if (now - last).days < 7:
                remain_data[k] = v
        d["guest"] = remain_data

    # socketio.run(app)
    socketio.run(app, host='0.0.0.0', debug=True)
    #socketio.run(app, host='0.0.0.0', debug=False)