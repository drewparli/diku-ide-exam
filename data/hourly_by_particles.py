import json


def get_date(stamp):
    date = stamp.split('T')[0]
    return date


def get_particle(obj, particle):
    if particle in obj:
        return obj[particle]
    else:
        return 0


if __name__ == '__main__':
    # {"Recorded":"2017-01-31T23:30:00","SO2":0.462156326,"NO2":31.55625,"PM10Teom":69.2,"O3":55.08455,"CO":0.4711964,"NOx":53.44662,"PM25Teom":40.0}
    file_name_begin = "./HCAB/HCAB_2017-"
    particles = ["SO2", "NO2", "PM10Teom", "O3", "CO", "PM25Teom"]
    particle_dict = {"SO2": "SO2", "NO2": "NO2", "PM10Teom": "PM10", "O3": "O3", "CO": "CO", "PM25Teom": "PM25"}
    date_dict = dict()
    particle_hourly = dict()

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

                if particle_translated == "CO":
                    particle_val *= 1000

                if date in date_dict:
                    if particle_translated in date_dict[date]:
                        list_part = date_dict[date][particle_translated]
                        list_part.append(particle_val)
                        date_dict[date][particle_translated] = list_part
                    else:
                        date_dict[date][particle_translated] = [particle_val]
                else:
                    date_dict[date] = dict()
                    date_dict[date][particle_translated] = [particle_val]

    for particle in particle_dict.values():
        particle_hourly[particle] = {}

    for date in sorted(date_dict.keys()):
        for particle in particle_dict.values():
            particle_hourly[particle][date] = list(reversed(date_dict[date][particle]))

    with open("data-by-particles-hourly.json", "w") as f:
        f.write(json.dumps(particle_hourly))