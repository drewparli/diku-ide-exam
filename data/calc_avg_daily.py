import json


def get_date(stamp):
    date = stamp.split('T')[0]
    return date


def get_particle(obj, particle):
    if particle in obj:
        return obj[particle]
    else:
        return None


if __name__ == '__main__':
    # {"Recorded":"2017-01-31T23:30:00","SO2":0.462156326,"NO2":31.55625,"PM10Teom":69.2,"O3":55.08455,"CO":0.4711964,"NOx":53.44662,"PM25Teom":40.0}
    file_name_begin = "./HCAB/HCAB_2017-"
    particles = ["SO2", "NO2", "PM10Teom", "O3", "CO", "PM25Teom"]
    particle_dict = {"SO2": "SO2", "NO2": "NO2", "PM10Teom": "PM10", "O3": "O3", "CO": "CO", "PM25Teom": "PM25"}
    date_dict = dict()
    particle_daily = dict()

    for i in range(1, 13):
        number = ("0" if i < 10 else "") + str(i)
        file_name = file_name_begin + str(number) + ".json"
        arr = json.load(open(file_name))

        for i in range(0, len(arr)):
            obj = arr[i]
            date = get_date(obj["Recorded"])

            for particle in particles:
                particle_val = get_particle(obj, particle)
                particle_translated = particle_dict[particle]

                if particle_val is not None:
                    if date in date_dict:
                        if particle_translated in date_dict[date]:
                            list = date_dict[date][particle_translated]
                            list.append(particle_val)
                            date_dict[date][particle_translated] = list
                        else:
                            date_dict[date][particle_translated] = [particle_val]
                    else:
                        date_dict[date] = dict()
                        date_dict[date][particle_translated] = [particle_val]

    for particle in particle_dict.values():
        particle_daily[particle] = []

    for date in sorted(date_dict.keys()):
        for particle in particle_dict.values():
            date_obj = dict()
            date_obj["date"] = date

            if particle in date_dict[date]:
                date_obj["value"] = sum(date_dict[date][particle]) / len(date_dict[date][particle])

                if particle == "CO":
                    date_obj["value"] *= 1000
            else:
                date_obj["value"] = 0

            list = particle_daily[particle]
            list.append(date_obj)
            particle_daily[particle] = list

    with open("data-daily.json", "w") as f:
        f.write(json.dumps(particle_daily))