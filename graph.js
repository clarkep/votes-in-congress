// https://stackoverflow.com/a/14991797/3137916
function parseCSV(str) {
    const arr = [];
    let quote = false;

    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];  // Current character, next character
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';

        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }

        if (cc == '"') { quote = !quote; continue; }

        if (cc == ',' && !quote) { ++col; continue; }

        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }

        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }

        arr[row][col] += cc;
    }
    return arr; 
}

export function degcos(deg) {
  return Math.cos(deg * Math.PI / 180);
}

export function degsin(deg) {
    return Math.sin(deg * Math.PI / 180);
}

export function degatan2(y, x) {
  return (Math.atan2(y, x)*180) / Math.PI;
}

/* Rows in table for which f(row) is true */
function array_matches(array, f)
{
    var result = [];
    for (var i=0; i<array.length; i++) {
        if (f(array[i])) {
            result.push(array[i]);
        }
    }
    return result;
}

// TODO: make faster! If I can find start and end dates for legislators,
// this won't be necessary. Otherwise, pre-compute first vote and last vote
// for members and see if they overlap. 
function voted_together(ic1, ic2) {
    var ic1_voted = false;
    var ic2_voted = false;
    var current_roll_n = 0;
    for (var i=0; i<st.votes.length; i++) {
        // assume votes are in order
        var vote = st.votes[i];
        var vote_ic = Math.round(vote[3]).toString();
        if (current_roll_n != vote[2]) {
            ic1_voted = false;
            ic2_voted = false;
            current_roll_n = vote[2];
        }
        if (vote_ic == ic1) {
            ic1_voted = true;
        } else if (vote_ic == ic2) {
            ic2_voted = true;
        }
        if (ic1_voted && ic2_voted) {
            return true;
        }
    }
    return false;
}

const HOUSE = 0;
const SENATE = 1;
const chamber_str = {
    [HOUSE]: "House",
    [SENATE]: "Senate",
}

function filter_chamber(table, which_chamber) {
    var result = []
    for (var i=0; i<table.length; i++) {
        var row = table[i];
        if (row[1] === chamber_str[which_chamber]) {
            result.push(row);
        }
    }
    return result;
}

// Returns: sorted array of svg elements
function chamber_seats(which_chamber) {
    var svg = document.querySelector("#chamber");
    const svgWidth = svg.width.baseVal.value;
    const svgHeight = svg.height.baseVal.value;
    // My: coordinates such that y is up. Transformed with svgHeight-My 
    const origin_x = svgWidth / 2; const origin_My = 30; 
    var r = origin_x - 240;
    if (which_chamber == HOUSE) {
        var rows = [ 22, 25, 31, 34, 38, 41, 43, 45, 47, 53, 56];
        var c_r = 8;
        var d_r = 21;
    } else {
        var rows = [ 13, 14, 16, 17, 19, 21 ];
        c_r = 12;
        var d_r = 40;
    }
    var seats = [];
    for (var i=0; i<rows.length; i++) {
        var theta = 0;
        var n = rows[i];
        for (var j=0; j<n; j++) {
            var x = origin_x + r*degcos(theta);
            var My = origin_My + r*degsin(theta);
            var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x.toString()); circle.setAttribute("cy", (svgHeight - My).toString());
            circle.setAttribute("r", c_r.toString());
            circle.setAttribute("fill", "#888888");
            circle.setAttribute("stroke", "black");
            // Spots are ordered by angle, with row as a tie breaker 
            circle.order = Math.floor(theta)*rows.length + i;
            circle.setAttribute("order", circle.order.toString());
            circle.addEventListener("mouseover", mouseOver);
            circle.addEventListener("mouseout", mouseOut);
            seats.push(circle);
            theta += 180. / (n-1);
        }
        r += d_r;
    }
    seats.sort((a, b) => a.order - b.order)
    return seats;
}

function house_members(members, chamber_seats) { 
    var dup = 0;
    var result = {};
    var chamber_members = [];
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "House") {
            var member = members[i];
            var dups = array_matches(members, row => (row[3]==member[3] && row[4]==member[4] && row[2]!=member[2]));
            if (member[4] == 0) {
                // non voting
                console.assert(["VI", "PR", "MP", "GU", "DC", "AS"].includes(member[5]));
                continue;
            } else {
                var dups = array_matches(members, row => 
                    (row[3]==member[3] && row[4]==member[4] && row[2]!=member[2]));
                dups = dups.map(row=>row[2]);
                result[member[2]] = { "member": member, "dups": dups };
                chamber_members.push(member[2]);
            }
        }
    }
    // console.log(dup.toString() + " duplicate members");
    const nominate_col = 13;
    chamber_members.sort((a, b) => result[b].member[nominate_col]-result[a].member[nominate_col]);
    var seat_i = 0;
    for (var i=0; i<chamber_members.length; i++) {
        var icspr = chamber_members[i];
        var member = result[icspr];
        if (member.seat) {
           continue; 
        } else {
            member.seat = chamber_seats[seat_i];
            for (var j=0; j<member.dups.length; j++) {
                var dup = result[member.dups[j]];
                // same seat
                dup.seat = chamber_seats[seat_i];
            }
            seat_i += 1;
        }
    }
    return result;
}

function senate_members(members, chamber_seats) {
    var result = {};
    var chamber_members = [];
    var states = {};
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "Senate") {
            var member = members[i];
            var icspr = member[2];
            result[icspr] = { "member": member };
            chamber_members.push(icspr);
            var state = member[5];
            if (states[state]) { 
                states[state].push(icspr);
            } else {
                states[state] = [icspr];
            }
        }
    }
    const nominate_col = 13;
    chamber_members.sort((a, b) => result[b].member[nominate_col]-result[a].member[nominate_col]);
    var seat_i = 0;
    for (var i=0; i<chamber_members.length; i++) {
        var icspr = chamber_members[i];
        var member = result[icspr];
        if (member.seat) {
            continue;
        }
        member.seat = chamber_seats[seat_i];
        if (states[member.member[5]].length > 2) {
            var state = states[member.member[5]];
            var seat_group = [ icspr ];
            var cur = icspr;
            for (var j=0; j<state.length; j++) {
                if (result[state[j]].seat) {
                    continue;
                }
                if (!seat_group.some((ic) => voted_together(ic, state[j]))) {
                    console.log("sharing a seat: ", cur, result[cur].member[9], state[j], result[state[j]].member[9]);
                    result[state[j]].seat = chamber_seats[seat_i];
                    seat_group.push(state[j]);
                }
            }
        }
        seat_i += 1;

    }
    return result;
}

/* 
  Assiging seats is different enough between the chambers that it
  makes sense to use different functions.

  Returns: map, { [icspr]: { "member": table row, "seat": seat } } 
*/
function chamber_members(members, which_chamber, chamber_seats) {
    if (which_chamber==HOUSE) {
        return house_members(members, chamber_seats);
    } else {
        return senate_members(members, chamber_seats);
    }
}

function init_chamber(which_chamber, rollcalls, votes, members) {
    var chamber = { which: which_chamber,
                    vote: 2
                };

    chamber.seats = chamber_seats(which_chamber);

    chamber.members = chamber_members(members, which_chamber, chamber.seats);

    chamber.votes = filter_chamber(votes, which_chamber);
    
    chamber.rollcalls = filter_chamber(rollcalls, which_chamber);

    return chamber; 
}

function draw_chamber(chamber) {
    var svg = document.querySelector("#chamber");
    svg.innerHTML = "";
    for (var i=0; i<chamber.seats.length; i++) {
        svg.appendChild(chamber.seats[i]);
    }
}

function reset_vote(chamber) {
    for (var i=0; i<chamber.seats.length; i++) {
        chamber.seats[i].setAttribute("fill", "#888888");
    }
}

const vote_codes = {
    0: "not_member", // Not a member when vote was taken
    1: "yea", // Yea
    2: "yea", // Paired Yea
    3: "yea", // Announced Yea
    4: "nay", // Announced Nay
    5: "nay", // Paired Nay
    6: "nay", // Nay 
    7: "skip", // Present (some Congreses)
    8: "skip", // Present (some Congresses)
    9: "skip", // Not Voting(Abstention)
};

const vote_colors = {
    200: {  // Republican
        not_member: "#ffffff", // error
        yea: "#ff0030",
        nay: "#ffd8e9",
        skip: "#888888"
    },
    100: { // Democratic
        not_member: "#ffffff",
        yea: "#4000ff",
        nay: "#d3deff",
        skip: "#888888",
    },
    328: { // Independent/Other
        not_member: "#ffffff",
        yea: "#40ff00",
        nay: "#d3ffde",
        skip: "#888888",
    }
};

const party_names_short = {
    200: "Rep",
    100: "Dem",
    328: "Other",
};

function voteview_url(rollcall) {

}

function update_label(rollcall, vote_cmp) {
    const count = document.querySelector("#vote-result");
    const result_str = (Number(rollcall[6]) > Number(rollcall[7])) ? "Passed" : "Failed";
    const result = document.querySelector("#vote-result");
    result.innerHTML = result_str;
    const yea_count = document.querySelector("#yea-count");
    yea_count.innerHTML = rollcall[6];
    const nay_count = document.querySelector("#nay-count");
    nay_count.innerHTML = rollcall[7];
    const yea_breakdown = document.querySelector("#yea-breakdown");
    yea_breakdown.innerHTML = "<small> (D: " + vote_cmp[100].yea 
                  + ", R: " + vote_cmp[200].yea
                  + (vote_cmp[328].yea ? (", O: " + vote_cmp[328].yea) : "</span>") 
                  + ")</small>";
    console.log(100 / yea_breakdown.textContent.length);
    const nay_breakdown = document.querySelector("#nay-breakdown"); 
    nay_breakdown.innerHTML = "<small> (D: " + vote_cmp[100].nay 
                  + ", R: " + vote_cmp[200].nay
                  + (vote_cmp[328].nay ? (", O: " + vote_cmp[328].nay) : "</span>") 
                  + ")</small>";
    const not_voting_label = document.querySelector("#not-voting-label");
    not_voting_label.innerHTML = "Not Voting: " + (vote_cmp[100].skip + vote_cmp[200].skip + vote_cmp[328].skip);
}

function load_vote(chamber, rollnum) {
    console.log("loading vote ", rollnum);
    const chamber_str = chamber.which == HOUSE ? "House" : "Senate";
    var i=0;
    var n=0;
    var misses = 0;
    var vote_cmp = { 200: { yea: 0, nay: 0, skip: 0 },
                 100: { yea: 0, nay: 0, skip: 0 },
                 328: { yea: 0, nay: 0, skip: 0 }};
    while(n < 1000 && i < chamber.votes.length) {
        if (chamber.votes[i][2] == rollnum) {
            var vote = chamber.votes[i];
            var icspr = Math.round(vote[3]).toString();
            var member = chamber.members[icspr];
            if (!member) {
                // Sometimes a president's vote is listed as a vote 
                // in one of the chambers.
                // TODO: add assertion to that effect
                i += 1;
                continue;
            }
            var seat = member.seat;
            if (seat) {
                var party_code = member.member[6] 
                var vote_code = vote_codes[vote[4]];
                var fill = vote_colors[party_code][vote_code];
                vote_cmp[party_code][vote_code] += 1;
                seat.setAttribute("fill", fill);
                seat.setAttribute("icspr", icspr);
            } else {
                misses += 1;
            }
            n++;
        }
        i++;
    }
    const rc = chamber.rollcalls[rollnum-1];
    update_label(rc, vote_cmp); 
}

function rollcall_table(rollcalls, which_chamber) {
    const chamber_str = which_chamber === HOUSE ? "House" : "Senate";
    console.log(chamber_str);
    const tbl = document.querySelector("#rollcalls table");
    tbl.innerHTML = "";
    for (var i=1; i<rollcalls.length; i++) {
        var row = rollcalls[i];
        if (row[1]===chamber_str && row[15].trim().length) {
            var tr = tbl.appendChild(document.createElement("tr"));
            // var td = tr.appendChild(document.createElement("td"));
            var button = tr.appendChild(document.createElement("button"));
            button.setAttribute("class", "vote-button");
            button.setAttribute("vote-number", row[2].toString());
            button.addEventListener("click", voteClicked);
            button.innerHTML = row[2].toString() + ". " + row[15].trim() + " <span style='color: #666666;'><br>" + row[16] + "</span>";
        }
    }
}

var st = { 
    rollcalls: null,
    votes: null,
    house: null,
    senate: null,
    selected: null,
    house_vote: 2,
    senate_vote: 2,
};

function mouseOver(event) {
    event.target.setAttribute("stroke-width", "3");
    const icspr = event.target.getAttribute("icspr");
    const member = st.selected.members[icspr];
    console.log(st.selected.members[icspr].member);
    const popup = document.querySelector("#member-popup");
    popup.style.visibility = "visible";
    popup.style.top = Math.round(Number(event.target.getAttribute("cy"))-100)+"px";
    popup.style.left = Math.round(Number(event.target.getAttribute("cx"))+5)+"px";
    popup.innerHTML = member.member[9];
}

function mouseOut(event) {
    event.target.setAttribute("stroke-width", "1");
    const popup = document.querySelector("#member-popup");
    popup.style.visibility = "hidden";
}

function voteClicked(event) {
    console.log("voteClicked");
    var button;
    // XXX
    if (event.target.matches("button")) {
        button = event.target;
    } else if (event.target.matches("span")) {
        button = event.target.parentNode;
    } 
    reset_vote(st.selected);
    var vote_n = Number(button.getAttribute("vote-number"));
    st.selected.vote = vote_n;
    load_vote(st.selected, vote_n, st.votes, st.rollcalls);
}

function chamberSelected(event) {
    var chamber = event.target.value=="House" ? st.house : st.senate;
    console.log(chamber.which);
    st.selected = chamber;
    draw_chamber(chamber);
    rollcall_table(st.rollcalls, chamber.which);
    load_vote(chamber, chamber.vote, st.votes, st.rollcalls);
}

function main(rollcalls_str, votes_str, members_str) {
    const rollcalls = parseCSV(rollcalls_str);
    st.rollcalls = rollcalls;
    const votes = parseCSV(votes_str);
    st.votes = votes;
    const members = parseCSV(members_str);

    st.house = init_chamber(HOUSE, rollcalls, votes, members);
    st.senate = init_chamber(SENATE, rollcalls, votes, members);
    st.selected = st.house;
    draw_chamber(st.house);
    rollcall_table(rollcalls, HOUSE);

    const select_chamber = document.querySelector("#select-chamber");
    select_chamber.addEventListener("change", chamberSelected);

    load_vote(st.selected, st.selected.vote, votes, rollcalls);
}

const rollcallsPromise = fetch("HS117_rollcalls.csv").then(response => response.text());
const votesPromise = fetch("HS117_votes.csv").then(response => response.text());
const membersPromise = fetch("HS117_members.csv").then(response => response.text());

Promise.all([rollcallsPromise, votesPromise, membersPromise]).then(values => main(...values));