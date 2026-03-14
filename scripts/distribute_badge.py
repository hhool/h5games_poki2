import json
import random

# 路径请根据实际情况调整
GAMES_JSON_PATH = '/Users/yanmenghou/Desktop/h5games/h5games_poki2/games.json'

with open(GAMES_JSON_PATH, 'r', encoding='utf-8') as f:
    games = json.load(f)

category_games = {}
for game in games:
    tags = game.get('tags', [])
    if tags:
        category = tags[0]
        category_games.setdefault(category, []).append(game)

for category, items in category_games.items():
    random.shuffle(items)
    if random.choice([True, False]):
        items[0]['badge'] = 'popular'
        items[0]['featured'] = True
    else:
        items[0]['badge'] = 'hot'
        items[0]['featured'] = True
    for i in range(1, len(items)):
        items[i]['featured'] = False
        items[i]['badge'] = 'none'

with open(GAMES_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(games, f, ensure_ascii=False, indent=2)
