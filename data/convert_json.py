import json


def form_id(stamp):
    date, time = stamp.split('T')
    return date + " " + time[0:-3]


def get_date_parts(stamp):
    date = stamp.split('T')[0]
    data_parts = date.split('-')
    year = int(data_parts[0])
    month = int(data_parts[1])
    day = int(data_parts[2])
    return year, month, day


def get_time(stamp):
    date = stamp.split('T')[1]
    data_parts = date.split(':')
    hour = int(data_parts[0])
    min = int(data_parts[1])

    return hour + 0.5 if min != 0 else hour


def create_parts_obj():
    parts = dict()

    parts["SO2"] = dict()
    parts["SO2"]["units"] = "myg/m3"
    parts["SO2"]["limit"] = 20

    parts["NO2"] = dict()
    parts["NO2"]["units"] = "myg/m3"
    parts["NO2"]["limit"] = 200

    parts["PM10"] = dict()
    parts["PM10"]["units"] = "myg/m3"
    parts["PM10"]["limit"] = 40

    parts["O3"] = dict()
    parts["O3"]["units"] = "myg/m3"
    parts["O3"]["limit"] = 120

    parts["CO"] = dict()
    parts["CO"]["units"] = "mg/m3"
    parts["CO"]["limit"] = 10

    parts["NOx"] = dict()
    parts["NOx"]["units"] = "myg/m3"
    parts["NOx"]["limit"] = 30

    parts["PM25"] = dict()
    parts["PM25"]["units"] = "myg/m3"
    parts["PM25"]["limit"] = 25

    return parts


def create_date_obj(date):
    year, month, day = get_date_parts(date)

    date_obj = dict()
    date_obj["id"] = form_id(date)
    date_obj["year"] = year
    date_obj["month"] = month
    date_obj["day"] = day
    date_obj["time"] = get_time(date)

    return date_obj


def create_particle_obj(name, limit, val, prev_val, next_val):
    particle_obj = dict()
    particle_obj["name"] = name

    if val is None:
        particle_obj["miss"] = True

        if prev_val is not None and next_val is not None:
            particle_obj["inter"] = True
            particle_obj["value"] = (prev_val + next_val) / 2
            particle_obj["percent"] = (100 * particle_obj["value"] / limit) - 100
        else:
            particle_obj["inter"] = False
            particle_obj["value"] = None
            particle_obj["percent"] = None
    else:
        particle_obj["miss"] = False
        particle_obj["inter"] = False
        particle_obj["value"] = val
        particle_obj["percent"] = (100 * particle_obj["value"] / limit) - 100

    return particle_obj


def get_particle(obj, particle):
    if particle in obj:
        return obj[particle]
    else:
        return None


if __name__ == '__main__':
    # {"Recorded":"2017-01-31T23:30:00","SO2":0.462156326,"NO2":31.55625,"PM10Teom":69.2,"O3":55.08455,"CO":0.4711964,"NOx":53.44662,"PM25Teom":40.0}
    file_name = "./HCAB/HCAB_2017-01.json"
    particles = ["SO2", "NO2", "PM10Teom", "O3", "CO", "NOx", "PM25Teom"]
    particle_dict = {"SO2": "SO2", "NO2": "NO2", "PM10Teom": "PM10", "O3": "O3", "CO": "CO", "NOx": "NOx",
                     "PM25Teom": "PM25"}

    all_data = []
    data = dict()
    parts = create_parts_obj()
    key_map = dict()
    arr = json.load(open(file_name))

    for i in range(0, len(arr)):
        data = dict()
        obj = arr[i]

        date = obj["Recorded"]
        data["date"] = create_date_obj(date)

        data["particles"] = []

        for particle in particles:
            prev_val = get_particle(arr[i - 1], particle) if i != 0 else None
            next_val = get_particle(arr[i + 1], particle) if (i + 1 < len(arr)) else None
            particle_obj = create_particle_obj(particle_dict[particle], parts[particle_dict[particle]]["limit"], get_particle(obj, particle), prev_val, next_val)
            data["particles"].append(particle_obj)

        all_data.append(data)

    all_data.sort(key=lambda x: x["date"]["id"], reverse=False)

    for i in range(0, len(all_data)):
        key_map[all_data[i]["date"]["id"]] = i

    final_data = dict()
    final_data["data"] = all_data
    final_data["parts"] = parts
    final_data["key_map"] = key_map

    with open("data-hourly.json", "w") as f:
        f.write(json.dumps(final_data))
     #   f.write(json.dumps(key_map))
    #    f.write(json.dumps(parts))
