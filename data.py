#!/usr/bin/env python3

import csv
import os
import pdb
import brotli
import argparse

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
MEM_first_roll = 22
MEM_last_roll = 23
MEM_chamber_col_key = 24

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
VT_icspr = 3
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
                # these are all presidents whose positions on bills are listed as votes; we throw them away.
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

def build_vote_matrix(members_path, votes_path, matrix_path):
    # augment members with keys
    member_rows = []
    icspr_to_key = {}
    write_members = True
    key_i = 0
    with open(members_path, "r") as f:
        r = csv.reader(f)
        header = next(r)
        assert "first_roll" in header and "last_roll" in header
        if not "chamber_col_key" in header:
            header.append("chamber_col_key")
            member_rows.append(header)
            for row in r:
                icspr = int(float(row[MEM_icspr]))
                if not icspr in icspr_to_key:
                    icspr_to_key[icspr] = key_i
                    key_i += 1
                row.append(icspr_to_key[icspr])
                member_rows.append(row)
        else:
            write_members = False
            for row in r:
                icspr = int(float(row[MEM_icspr]))
                icspr_to_key[icspr] = int(row[MEM_chamber_row_key])
    if write_members:
        with open(members_path, mode="w+", newline="", encoding="utf-8") as out:
            w = csv.writer(out)
            w.writerows(member_rows)
    # rollcall keys are the rollnumber(column 3) - 1.
    not_found_members = []
    vote_matrix_rows = 1
    vote_matrix = bytearray()
    matrix_row = bytearray(len(icspr_to_key))
    row_i = 0
    with open(votes_path, "r") as f:
        r = csv.reader(f)
        header = next(r)
        for row in r:
            rollnum = int(row[VT_rollnumber])
            icspr = int(float(row[VT_icspr]))
            if rollnum - 1 != row_i:
                row_i += 1
                assert rollnum - 1 == row_i, "Expected votes.csv to have simply increasing rollnum 1->max"
                vote_matrix += matrix_row
                matrix_row = bytearray(len(icspr_to_key))
            # assert icspr in icspr_to_key, "Unexpected member while building vote matrix"
            if icspr in icspr_to_key:
                col_i = icspr_to_key[icspr]
                matrix_row[col_i] = int(float(row[VT_cast_code]))
            else:
                if not icspr in not_found_members:
                    print(f"build_vote_matrix {votes_path}: Vote found for member {icspr} with no member key")
                    not_found_members.append(icspr)

    vote_matrix += matrix_row
    with open(matrix_path, mode="wb+") as out:
        out.write(vote_matrix)

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

def main():
    parser = argparse.ArgumentParser(prog='data.py')
    parser.add_argument("phase", type=int, default=0, nargs="?")
    parser.add_argument("-c", "--congress", default=0)
    parser.add_argument("-d", "--dir", default="data")
    args = parser.parse_args()

    out = args.dir
    congresses = list(range(1, CURRENT_CONGRESS+1)) if args.congress==0 else [args.congress]

    if args.phase == 1 or args.phase == 0:
        print("Splitting files....")
        if args.congress == 0:
            split_file_by_congress_and_chamber("raw/HSall_members.csv", f"{out}/{{}}{{}}_members.csv")
            split_file_by_congress_and_chamber("raw/HSall_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
            split_file_by_congress_and_chamber("raw/HSall_votes.csv", f"{out}/{{}}{{}}_votes.csv")
            split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_members.csv", f"{out}/{{}}{{}}_members.csv")
            split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
            split_file_by_congress_and_chamber(f"raw/HS{CURRENT_CONGRESS}_votes.csv", f"{out}/{{}}{{}}_votes.csv")
        elif args.congress == CURRENT_CONGRESS:
            split_file_by_congress_and_chamber(f"raw/HS{args.congress}_members.csv", f"{out}/{{}}{{}}_members.csv")
            split_file_by_congress_and_chamber(f"raw/HS{args.congress}_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
            split_file_by_congress_and_chamber(f"raw/HS{agrs.congress}_votes.csv", f"{out}/{{}}{{}}_votes.csv")
        else:
            split_file_by_congress_and_chamber("raw/HSall_members.csv", f"{out}/{{}}{{}}_members.csv")
            split_file_by_congress_and_chamber("raw/HSall_rollcalls.csv", f"{out}/{{}}{{}}_rollcalls.csv")
            split_file_by_congress_and_chamber("raw/HSall_votes.csv", f"{out}/{{}}{{}}_votes.csv")
    if args.phase == 2 or args.phase == 0:
        print("Finding first and last votes for members")
        for i in congresses:
            findFL(f"{out}/H{i}_members.csv", f"{out}/H{i}_votes.csv")
            findFL(f"{out}/S{i}_members.csv", f"{out}/S{i}_votes.csv")
    if args.phase == 3 or args.phase == 0:
        print("Building vote matrices")
        for i in congresses:
            build_vote_matrix(f"{out}/H{i}_members_v2.csv", f"{out}/H{i}_votes.csv", f"{out}/H{i}_votematrix")
            build_vote_matrix(f"{out}/S{i}_members_v2.csv", f"{out}/S{i}_votes.csv", f"{out}/S{i}_votematrix")


main()
# data_from_raw("data")
# split_file_by_congress_and_chamber("raw/HS119_votes.csv", "data2/{}{}_votes.csv")
# find_fl_all()
# remove_congress_from_all(119)
# list_sizes()
# compress_members_and_rollcalls()
# list_sizes(compressed=True)