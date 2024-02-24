import os
import io
import json
import random

def make_deck(id: int, back_path: str):
    pass

def make_playingcard_deck(id: int):
    id = 0
    name = u"トランプ"
    contents = []

    for i in range(54):
        img = ["s", "h", "d", "k", "j"][i // 13] + str((i % 13) + 1).zfill(2) + ".png"
        path = "/static/common/img/playingcard/" + img
        name = ["スペード", "ハート", "ダイヤ", "クラブ", "ジョーカー"][i // 13]
        name = name + "の" + str(i % 13) if i < 52 else name
        
        contents.append({"cardid": i, "name": name, "path": path, "text": ""})

    d = {"name": "トランプ", "contents": contents,
         "back": "/static/common/img/playingcard/back.png",
         "stock_x": -100, "stock_y": 0, 
         "discard_x": 100, "discard_y": 0,
         "width": 96, "height": 144,
         "stock": random.sample(range(54), 54), "discard": []
         }
    return (str(id), d)