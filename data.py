#!/usr/bin/env python3

import csv
import os
import pdb

def findFL(congress_n):
    f1 = open("data/HS{}_members.csv".format(congress_n), "r")
    f2 = open("data/HS{}_votes.csv".format(congress_n), "r")
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
        try: 
            member = members[icspr]
        except:
            print("Congress {} failed: members {} not found".format(congress_n, icspr))
            continue
        if int(row[2]) < member[0]:
            member[0] = int(row[2])
        if int(row[2]) > member[1]:
            member[1] = int(row[2])
    result[0] += ["first_roll", "last_roll"]
    for row in result[1:]:
        row += members[row[2]]
    out = open("data/HS{}_members_v2.csv".format(congress_n), "w+")
    w = csv.writer(out)
    w.writerows(result)

# Still used for rollcalls. Use the next one for members, votes
def split_file_by_congress(fn, out_format):
    f = open(fn, "r", encoding="utf-8")
    reader = csv.reader(f)
    current_i = 1
    header = next(reader)
    current = [header]
    for row in reader:
        if int(row[0]) != current_i:
            next_i = int(row[0])
            assert (next_i == current_i + 1)
            out = open(out_format.format(current_i), mode="w+", newline="", encoding="utf-8")
            writer = csv.writer(out)
            writer.writerows(current)
            out.close()
            current_i = next_i
            current = [header, row]
        else:
            current.append(row)
    out = open(out_format.format(current_i), mode="w+", newline="", encoding="utf-8")
    writer = csv.writer(out)
    writer.writerows(current)
    out.close()

def split_members_and_votes():
    member_fn = "HSall_members.csv"
    votes_fn = "HSall_votes.csv"
    all_members = {}
    member_sep = []
    member_sep_ic = []
    f1 = open(member_fn, mode="r", encoding="utf-8")
    r1 = csv.reader(f1)
    member_header = next(r1)
    for row in r1:
        all_members[row[2]] = row 
        congress = int(row[0])
        if len(member_sep) > congress-1:
            member_sep[congress-1].append(row)
            member_sep_ic[congress-1][row[2]] = row
        else:
            member_sep.append([member_header, row])
            member_sep_ic.append({ row[2]: row })

    f2 = open(votes_fn, mode="r", encoding="utf-8") 
    r2 = csv.reader(f2)
    vote_header = next(r2)
    votes_sep = []
    row_i = 0
    for row in r2:
        if row_i % 100000 == 0:
            print("Row {}".format(row_i))
        congress = int(row[0])
        icspr = str(int(float(row[3])))
        if len(votes_sep) > congress-1:
            votes_sep[congress-1].append(row)
        else:
            votes_sep.append([vote_header, row])
        
        if icspr not in member_sep_ic[congress-1]:
            print("member {} ({}) not listed for congress {}. Checking all...".format(icspr, row[1], congress), end="")
            if icspr in all_members:
                member_sep[congress-1].append(all_members[icspr])
                member_sep_ic[congress-1]  = all_members[icspr]
                print("found. Adding member {}({}) to congress {}".format(icspr, all_members[icspr][1], congress))
            else:
                print("not found anywhere! Ignoring...")
        row_i += 1

    members_out_format = "data/HS{}_members.csv"
    votes_out_format = "data/HS{}_votes.csv"
    for i, table in enumerate(member_sep):
        fn = members_out_format.format(i+1)
        print("writing", fn)
        out = open(fn, mode="w+", encoding="utf-8", newline="")
        writer = csv.writer(out)
        writer.writerows(table)

    for i, table in enumerate(votes_sep):
        fn = votes_out_format.format(i+1)
        print("writing", fn)
        out = open(fn, mode="w+", encoding="utf-8", newline="")
        writer = csv.writer(out)
        writer.writerows(table)

split_file_by_congress("HSall_rollcalls.csv", "data/HS{}_rollcalls.csv")
# split_members_and_votes()
# for i in range(1, 118):
#    print(i)
#    findFL(i)