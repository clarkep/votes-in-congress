#!/usr/bin/env python3

import csv

def findFL(congress_n):
    f1 = open("HS{}_members.csv".format(congress_n), "r")
    f2 = open("HS{}_votes.csv".format(congress_n), "r")
    members = {}
    r1 = csv.reader(f1)
    result = []
    result.append(next(r1))
    for row in r1:
        result.append(row)
        members[row[2]] = [9999999, -1]
    r2 = csv.reader(f2)
    next(r2)
    for row in r2:
        icspr = str(int(float(row[3])))
        if int(row[2]) < members[icspr][0]:
            members[icspr][0] = int(row[2])
        if int(row[2]) > members[icspr][1]:
            members[icspr][1] = int(row[2])
    result[0] += ["first_roll", "last_roll"]
    for row in result[1:]:
        row += members[row[2]]
    out = open("out{}_members.csv".format(congress_n), "w+")
    w = csv.writer(out)
    w.writerows(result)

findFL(117)