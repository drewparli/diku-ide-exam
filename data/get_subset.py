import json


if __name__ == '__main__':
    filename = "HCAB_2017.json"

    raw = json.load(open(filename))

    dates = sorted(raw.keys())[:200]

    print raw[dates[0]]

    data = dict()
    for d in dates:
        data[d] = raw[d]

    with open("subset.json", "w") as f:
        f.write(json.dumps(data))