#!/usr/bin/env python3

import csv
import os
import pdb
import brotli

CURRENT_CONGRESS = 119

MEM_congress = 0
MEM_chamber = 1
MEM_icspr = 2
MEM_state_icspr = 3
MEM_district_code = 4
MEM_state_abbrev = 5
MEM_party_code = 6
MEM_occupancy = 7
MEM_last_means = 8
MEM_bioname = 9
MEM_bioguide_id = 10
MEM_born = 11
MEM_died = 12
MEM_nominate_dim1 = 13
MEM_nominate_dim2 = 14
MEM_nominate_log_likelihood = 15
MEM_nominate_geo_mean_probability = 16
MEM_nominate_number_of_votes = 17
MEM_nominate_number_of_errors = 18
MEM_conditional = 19
MEM_nokken_poole_dim1 = 20
MEM_nokken_poole_dim2 = 21

RC_congress = 0
RC_chamber = 1
RC_rollnumber = 2
RC_date = 3
RC_session = 4
RC_clerk_rollnumber = 5
RC_yea_count = 6
RC_nay_count = 7
RC_nominate_mid_1 = 8
RC_nominate_mid_2 = 9
RC_nominate_spread_1 = 10
RC_nominate_spread_2 = 11
RC_nominate_log_likelihood = 12
RC_bill_number = 13
RC_vote_result = 14
RC_vote_desc = 15
RC_vote_question = 16
RC_dtl_desc = 17

VT_congress = 0
VT_chamber = 1
VT_rollnumber = 2
VT_icpsr = 3
VT_cast_code = 4
VT_prob = 5

######################################## Precleaning ###############################################

# These tasks are applied before data is checked in: downloading new data, and removing data from
# the latest congress from HS_all_{type}.csv

# Remove entries matching congress_n from HSAll_members, HSAll_rollcalls, and HSAll_votes. After
# each Congress, we redownload the full database to get data corrections and updates, and remove
# the partial data for the current Congress.
def remove_congress_from_all(congress_n):
    for data_type in ["members", "rollcalls", "votes"]:
        print("removing {}...".format(data_type))
        f = open("raw/HSAll_{}.csv".format(data_type), "r")
        out = open("raw/HSAll_{}_new.csv".format(data_type), mode="w+", newline="",
                                                 encoding="utf-8")
        reader = csv.reader(f)
        writer = csv.writer(out)
        writer.writerow(next(reader)) # header
        removed = 0
        for row in reader:
            if int(row[0])==congress_n:
                removed += 1
            else:
                writer.writerow(row)
        f.close()
        out.close()
        print("{} {} removed from HSAll".format(removed, data_type))

####################################################################################################

def findFL(members_path, votes_path):
    f1 = open(members_path, "r")
    f2 = open(votes_path, "r")
    members = {}
    r1 = csv.reader(f1)
    result = []
    result.append(next(r1))
    for row in r1:
        result.append(row)
        members[row[2]] = [9999999, -1]
    r2 = csv.reader(f2)
    next(r2)
    not_found_members = []
    for row in r2:
        icspr = str(int(float(row[3])))
        try:
            member = members[icspr]
        except:
            if not icspr in not_found_members:
                print("FindFL {}: members {} not found".format(members_path, icspr))
                not_found_members.append(icspr)
            continue
        if int(row[2]) < member[0]:
            member[0] = int(row[2])
        if int(row[2]) > member[1]:
            member[1] = int(row[2])
    result[0] += ["first_roll", "last_roll"]
    for row in result[1:]:
        row += members[row[2]]
    out = open(members_path[:-4] + "_v2.csv", "w+")
    w = csv.writer(out)
    w.writerows(result)

def split_file_by_congress_and_chamber(fn, out_format):
    f = open(fn, "r", encoding="utf-8")
    current_chamber = None
    current_chamber_short = None
    current_congress = 1
    reader = csv.reader(f)
    header = next(reader)
    current = [header]
    for row in reader:
        if row[1] != current_chamber:
            if current_chamber:
                out = open(out_format.format(current_chamber_short, current_congress), "w+")
                writer = csv.writer(out)
                writer.writerows(current)
                out.close()
            if row[1] == "House":
                current_chamber_short = "H"
            elif row[1] == "Senate":
                current_chamber_short = "S"
            else:
                continue
            current_chamber = row[1]
            current_congress = int(row[0])
            current = [header, row]
            print(current_congress, current_chamber)
        # if int(row[1]) != current_chamber:
        #     next_i = int(row[0])
        #     assert (next_i == current_congress + 1)
        #     out = open(out_format.format(current_congress), mode="w+", newline="", encoding="utf-8")
        #     writer = csv.writer(out)
        #     writer.writerows(current)
        #     out.close()
        #     current_congress = next_i
        #     current = [header, row]
        else:
            current.append(row)
    out = open(out_format.format(current_chamber_short, current_congress), mode="w+", newline="",\
        encoding="utf-8")
    writer = csv.writer(out)
    writer.writerows(current)
    out.close()

def list_sizes(compressed=False):
    members_sum = 0
    rollcalls_sum = 0
    votes_sum = 0
    for i in range(1, CURRENT_CONGRESS+1):
        mem_path = f"data/HS{i}_members_v2.csv.br" if compressed else f"data/HS{i}_members_v2.csv"
        rollcalls_path = f"data/HS{i}_rollcalls.csv.br" if compressed else f"data/HS{i}_rollcalls.csv"
        votes_path = f"data/HS{i}_votes.csv"

        members_size = os.path.getsize(mem_path)
        rollcalls_size = os.path.getsize(rollcalls_path)
        votes_size = os.path.getsize(votes_path)
        print(f"{i}, {members_size/1e6}, {rollcalls_size/1e6}, {votes_size/1e6}")

        members_sum += members_size
        rollcalls_sum += rollcalls_size
        votes_sum += votes_size

    print(f"Totals: {members_sum/1e6}, {rollcalls_sum/1e6}, {votes_sum/1e6}")

def compress_members_and_rollcalls():
    for i in range(1, CURRENT_CONGRESS+1):
        for data_type in ["members_v2", "rollcalls"]:
            path = f"data/HS{i}_{data_type}.csv"
            out_path= f"data/HS{i}_{data_type}.csv.br"
            print(f"Compressing {path}...")
            with open(path, "rb") as f, open(out_path, "wb+") as out:
                data = f.read()
                compressed = brotli.compress(data, quality=11, lgwin=22)
                out.write(compressed)

def data_from_raw(out):
    print("Splitting files....")
    split_file_by_congress_and_chamber("raw/HSall_members.csv", f"{out}/{{}}{{}}_members.csv")
    split_file_by_congress_and_chamber("raw/HSall_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
    split_file_by_congress_and_chamber("raw/HSall_votes.csv", f"{out}/{{}}{{}}_votes.csv")
    split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_members.csv", f"{out}/{{}}{{}}_members.csv")
    split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
    split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_votes.csv", f"{out}/{{}}{{}}_votes.csv")
    printf("Finding first and last votes for members...")
    for i in range(1, CURRENT_CONGRESS+1):
        print(i)
        findFL(f"data2/H{i}_members.csv", f"data2/H{i}_votes.csv")
        findFL(f"data2/S{i}_members.csv", f"data2/S{i}_votes.csv")

data_from_raw("data2")
# split_file_by_congress_and_chamber("raw/HS119_votes.csv", "data2/{}{}_votes.csv")
# find_fl_all()
# remove_congress_from_all(119)
# list_sizes()
# compress_members_and_rollcalls()
# list_sizes(compressed=True)