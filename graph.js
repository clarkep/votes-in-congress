// [1] 
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
function chamber_seats(which_chamber, how_many) {
    var svg = document.querySelector("#chamber");
    svg.setAttribute("viewBox", "0 0 800 450");
    const svgWidth = 800;
    const svgHeight = 450;
    if (which_chamber == HOUSE) {
        var rows = [ 22, 25, 31, 34, 38, 41, 43, 45, 47, 53, 56];
        var c_r = 8;
        var d_r = 21;
        var r = 160;
    } else {
        var rows = [ 16, 18, 20, 22, 24 ];
        c_r = 14;
        var d_r = 40;
        var r = 190;
    }
    // My: a y coordinate that points up. Transformed with svgHeight-My
    const origin_x = svgWidth / 2; const origin_My = 22 + c_r;
    var seats = [];
    var seat_i = 0;
    for (var i=0; i<rows.length && seat_i<how_many; i++) {
        var theta = 0;
        var n = rows[i];
        for (var j=0; j<n && seat_i<how_many; j++) {
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
            // XXX see load_vote
            circle.setAttribute("icspr", "-1");
            seats.push(circle);
            theta += 180. / (n-1);
            seat_i += 1;
        }
        r += d_r;
    }
    seats.sort((a, b) => a.order - b.order)
    return seats;
}

/* TODO: move seat assignment to pre-processing? */

function house_seat_groups(members) { 
    var districts = {};
    var seat_groups = [];
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "House") {
            var member = members[i];
            if (member[4] == 0) {
                // non voting
                console.assert(["VI", "PR", "MP", "GU", "DC", "AS"].includes(member[5]));
                continue;
            } else {
                var district_code = member[3]+member[4];
                var group;
                if (districts[district_code]) {
                    group = districts[district_code];
                    group.push(member);
                    // sort by reverse time served(last vote - first vote) 
                    group.sort((b, a) => (Number(a[23])-Number(a[22]))-(Number(b[23])-Number(b[22])));
                } else {
                    group = [member];
                    districts[district_code] = group;
                    seat_groups.push(group);
                }
            }
        }
    }
    const nominate_col = 13
    // sort by reverse ideology score(conservative -> liberal) of the longest serving member
    seat_groups.sort((b, a) => a[0][nominate_col]-b[0][nominate_col]);
    return seat_groups;
}

function senate_seat_groups(members) {
    var states = {}; 
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "Senate") {
            var member = members[i]; var icspr = member[2];
            var state = member[5];
            if (states[state]) { 
                states[state].push(member);
            } else {
                states[state] = [member];
            }
        }
    }
    var states_arr = Object.values(states);
    var seat_groups = [];
    for (var i=0; i<states_arr.length; i++) {
        var state = states_arr[i];
        // sort by start date
        state.sort((b, a) => (Number(b[22])-Number(a[22])));
        var groupA = [state[0]];
        var groupA_indices = [0];
        var groupA_i = 0;
        // Add senators who start immediately after the first senator finishes
        // to the same seat group, "group A". Group B is everyone not in group A.
        for (let j=1; j<state.length; j++) {
            if (Number(state[j][22])>=Number(groupA[groupA_i][23])) {
                groupA.push(state[j]);
                groupA_indices.push(j);
                groupA_i += 1;
            }
        }
        for (let j=groupA_indices.length-1; j>= 0 ; j--) {
            state.splice(groupA_indices[j], 1);
        }
        // sort by reverse time served(last vote - first vote) 
        groupA.sort((b, a) => (Number(a[23])-Number(a[22]))-(Number(b[23])-Number(b[22])));
        state.sort((b, a) => (Number(a[23])-Number(a[22]))-(Number(b[23])-Number(b[22])));
        seat_groups.push(groupA);
        if (state.length) {
            seat_groups.push(state);
        } else {
            // PA only had one senator in the 2nd Congress
            console.log(`No second senator found in ${groupA[0][5]}`);
        }
    }
    const nominate_col = 13;
    seat_groups.sort((b, a) => a[0][nominate_col]-b[0][nominate_col]);
    return seat_groups;
}

/* 
  Returns: map, { [icspr]: { "member": table row, "seat": seat } } 
*/
function assign_seats(seat_groups, chamber_seats) {
    var result = {};
    var seat_i = 0;
    for (var i=0; i<seat_groups.length; i++) {
        var group = seat_groups[i];
        for (var j=0; j<group.length; j++) {
            var mem = group[j];
            result[mem[2]] = { 
                member: mem,
                seat: chamber_seats[seat_i],
            }
        }
        seat_i += 1;
    }
    return result;
}

function init_chamber(which_chamber, rollcalls, votes, members) {
    var chamber = { which: which_chamber,
                    vote: 2
                };
    
    if (which_chamber==HOUSE) {
        var seat_groups = house_seat_groups(members, chamber_seats);
    } else {
        var seat_groups = senate_seat_groups(members, chamber_seats);
    }

    chamber.seats = chamber_seats(which_chamber, seat_groups.length);

    chamber.members = assign_seats(seat_groups, chamber.seats);

    chamber.votes = filter_chamber(votes, which_chamber);
    
    chamber.rollcalls = filter_chamber(rollcalls, which_chamber);

    return chamber; 
}

function draw_chamber(chamber) {
    var svg = document.querySelector("#chamber");
    document.addEventListener("mousemove", chamberMouseMove);
    svg.innerHTML = "";
    for (var i=0; i<chamber.seats.length; i++) {
        svg.appendChild(chamber.seats[i]);
    }
}

function reset_vote(chamber) {
    for (var i=0; i<chamber.seats.length; i++) {
        chamber.seats[i].setAttribute("icspr", "-1");
        chamber.seats[i].setAttribute("fill", "#888888");
    }
}

function reposition_label(event) {
    const all = document.querySelector("#vote-summary");
    const normal_w = 800;
    const normal_size = 0.85;
    const svg_w = st.chamber_svg.width.baseVal.value;
    all.style.fontSize = (normal_size * (svg_w/normal_w)).toString() + "rem";
    // XXX get the new width given updated fontSize
    const w = all.clientWidth;
    const svg_h = st.chamber_svg.height.baseVal.value;
    all.style.top = (0.80 * svg_h).toString() + "px";
    all.style.left = (0.5 * svg_w - 0.5*w).toString() + "px";
}

function result_short(result) {
    if (result.slice(-9)==="Agreed to") {
        return "Agreed to";
    } else if (result.slice(-8)==="Rejected") {
        return "Rejected";
    } else if (result.slice(-6)==="Passed") {
        return "Passed";
    } else if (result.slice(-8)==="Defeated") {
        return "Defeated";
    } else if (result.slice(-9)==="Confirmed") {
        return "Confirmed";
    } else if (result.slice(-13)==="Not Sustained") {
        return "Not Sustained";
    } else if (result.slice(-9)==="Sustained") {
        return "Sustained";
    }
    return null;
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
    100: "skip" // No entry in vote database
};

const vote_colors = {
    yea: {
        100: "#4000ff",
        200: "#ff0030",
        328: "#40ff00",
    },
    nay: {
        100: "#d3deff",
        200: "#ffd8e9",
        328: "#d3ffde",

    },
    skip: {
        100: "#888888",
        200: "#888888",
        328: "#888888",
    },
};

const party_short = {
    100: "D",
    200: "R",
    328: "I",
}

function update_label(rollcall, vote_cmp) {
    const count = document.querySelector("#vote-result");
    var result_str = result_short(rollcall[14]);
    result_str = result_str ? result_str : rollcall[14];
    const result = document.querySelector("#vote-result");
    result.innerHTML = result_str;
    const yea_count = document.querySelector("#yea-count");
    yea_count.innerHTML = rollcall[6];
    const nay_count = document.querySelector("#nay-count");
    nay_count.innerHTML = rollcall[7];

    const sides = [Object.entries(vote_cmp.yea), Object.entries(vote_cmp.nay)];
    // Breakdowns of the sides
    for (let i=0; i<2; i++) {
        var good_guys = sides[i];
        var text;
        if (good_guys.length) {
            good_guys.sort((e1, e2)=>(e2[1] - e1[1]));
            text = "<small>(";
            var n_others = 0; // Unknown party, hence "Other"
            for (let j=0; j<good_guys.length; j++) {
                let e = good_guys[j];
                if (party_short[e[0]]) {
                    text += party_short[e[0]] + ": " + e[1].toString() + ", ";
                } else {
                    n_others += e[1];
                }
            }
            if (!n_others) {
                text = text.slice(0, -2) + ")</small>";
            } else {
                text = text + "O: " + n_others.toString() + ")</small>";
            }
        } else {
            text = "";
        }
        if (i===0) {
            const yea_breakdown = document.querySelector("#yea-breakdown");
            yea_breakdown.innerHTML = text;
        } else {
            const nay_breakdown = document.querySelector("#nay-breakdown"); 
            nay_breakdown.innerHTML = text;
        }
    }

    const n_not_voting = Object.entries(vote_cmp.skip).reduce((acc, e)=>acc+Number(e[1]), 0);
    const not_voting_label = document.querySelector("#not-voting-label");
    not_voting_label.innerHTML = "Not Voting: " + n_not_voting;

    reposition_label(null);
}

function load_vote(chamber, rollnum) {
    /* 
       Sometimes a member is not listed at all on a vote, so we assign ids to
       every seat based on members' first and last votes(I still don't have
       their definitive start and end dates). However, if a member missed the
       *first few* or *last few* votes of their term, they can't be found and
       their seat will be listed as "unknown member".
  
       All of this means we have to loop through votes, members, and seats here
       to get all the information we need.

       TODO: move a lot of this to pre-processing?
    */
    console.log("loading vote ", rollnum);
    const chamber_str = chamber.which == HOUSE ? "House" : "Senate";
    var icspr_votes = {};
    // Collect all the explicitly listed votes
    for (var i=0; i< chamber.votes.length; i++) {
        if (chamber.votes[i][2] == rollnum) {
            var vote = chamber.votes[i];
            var icspr = Math.floor(Number(vote[3])).toString();
            var member = chamber.members[icspr];
            if (!member) {
                // Sometimes a president's vote is listed as a vote 
                // in one of the chambers.
                i += 1;
                continue;
            }
            // Congress 116 (at least) stores vote codes as string floats, e.g. "6.0"
            icspr_votes[icspr] = Math.floor(Number(vote[4]));
        }
    }
    var vote_cmp = { yea: { }, nay: { }, skip: { }};
    var misses = 0;
    // Find members who were in office for this vote but might not be explicitly listed
    for(const [icspr, member] of Object.entries(chamber.members)) {
        if (rollnum < member.member[22]|| rollnum > member.member[23]) {
            // presumably not in office at the time of the vote
            continue;
        }
        var seat = member.seat;
        if (seat) {
            var party_code = member.member[6]; 
            var vote_code = icspr_votes[icspr] ? vote_codes[icspr_votes[icspr]] : vote_codes[100];
            var fill = vote_colors[vote_code][party_code] ? vote_colors[vote_code][party_code] : vote_colors[vote_code][328];
            if (vote_cmp[vote_code][party_code]) {
                vote_cmp[vote_code][party_code] += 1;
            } else {
                vote_cmp[vote_code][party_code] = 1;
            }
            seat.setAttribute("fill", fill);
            seat.setAttribute("icspr", icspr);
        } else {
            console.log("miss", member);
            misses += 1;
        }
    }
    // Find seats that are still unaccounted for after step 2
    for (var i=0; i<chamber.seats.length; i++) {
        if (!chamber.members[chamber.seats[i].getAttribute("icspr")]) { // unknown member
            if (vote_cmp.skip[328]) {
                vote_cmp.skip[328] += 1;
            } else {
                vote_cmp.skip[328] = 1;
            }
        }
    }
    const rc = chamber.rollcalls[rollnum-1];
    update_label(rc, vote_cmp); 
}

function rollcall_table(rollcalls, which_chamber) {
    const chamber_str = which_chamber === HOUSE ? "House" : "Senate";
    const tbl = document.querySelector("#rollcalls");
    tbl.innerHTML = "";
    for (var i=1; i<rollcalls.length; i++) {
        var row = rollcalls[i];
        if (row[1]===chamber_str) {
            var tr = tbl.appendChild(document.createElement("tr"));
            // var td = tr.appendChild(document.createElement("td"));
            var button = tr.appendChild(document.createElement("div"));
            button.style.width = "100%";
            button.setAttribute("class", "vote-button");
            button.setAttribute("vote-number", row[2].toString());
            button.addEventListener("click", voteClicked);
            button.innerHTML = row[2].toString() + ". "
                               + (row[13].trim().length ?  "<span style='color: black;'>" + row[13].trim() + "</span><br>" : "")
                               + (row[15].trim().length ? row[15].trim() + "<br>" : (row[17].trim().length ? row[17].trim() + "<br>" : "") )
                               + " <span style='color: #666666;'>" + row[16] + "</span>";
        }
    }
}

var st = { 
    congress_selector: null,
    chamber_svg: null,
    rollcalls: null,
    votes: null,
    house: null,
    senate: null,
    selected: null,
    house_vote: 2,
    senate_vote: 2,
    over_seat: null,
    over_seat_selected_t: null,
    cur_button: null,
};

function dist(x1, y1, x2, y2) {
    return ((x2-x1)**2 + (y2-y1)**2)**0.5;
}

function chamberSelected(event) {
    const select_chamber = document.querySelector("#select-chamber");
    var chamber = select_chamber.value=="House" ? st.house : st.senate;
    st.cur_button = null;
    st.selected = chamber;
    draw_chamber(chamber);
    rollcall_table(st.rollcalls, chamber.which);
    load_vote(chamber, chamber.vote);
}

function fromSVGcoords(x, y)
{
    const svg_w = 800;
    const svg_h = 450;
    const x_scale = st.chamber_svg.width.baseVal.value / svg_w;
    const y_scale = st.chamber_svg.height.baseVal.value / svg_h;
    return [x*x_scale, y*y_scale]
}

function chamberMouseMove(event) {
    const elem = document.elementFromPoint(event.clientX, event.clientY);
    if (elem.tagName === "circle") {
        var elem_x, elem_y;
        [ elem_x, elem_y ] = fromSVGcoords(elem.cx.baseVal.value, elem.cy.baseVal.value);
        const no_hit_r = 2;
        if (!(elem == st.over_seat)
            && dist(elem_x, elem_y, event.layerX, event.layerY)
            <(Number(elem.getAttribute("r"))-no_hit_r)) {
            const popup = document.querySelector("#member-popup");
            popup.style.visibility = "visible";
            popup.style.top = Math.round(event.layerY-popup.clientHeight)+"px";
            popup.style.left = Math.round(event.layerX)+"px";
            const icspr = elem.getAttribute("icspr");
            const member = st.selected.members[icspr];
            if (!member) { // XXX see load_vote
                popup.innerHTML = "Unknown member";
            } else {
                popup.innerHTML = member.member[9];
            }
            st.over_seat = elem;
            st.over_seat_selected_t = Date.now();
        }
    } else if (elem.id !=="member-popup") {
        if (st.over_seat) {
            st.over_seat.setAttribute("stroke-width", "1");
            st.over_seat = null;
            const popup = document.querySelector("#member-popup");
            popup.style.visibility = "hidden";
        }
    }
}

function expand_button(button, vote_n) {
    var h = button.clientHeight;
    button.parentElement.style.borderWidth = "2px";
    button.parentElement.style.borderColor = "#888888";
    button.style.height = (h + 30).toString() + "px";
    button.style.backgroundColor = "#ffffff";
    button.style.userSelect = "auto";
    // const table = document.querySelector("#rollcalls");
    // table.scrollTo(0, button.offsetTop);
    const row = st.selected.rollcalls[vote_n - 1];
    const voteview = document.createElement("a");
    const vote_code = "R" 
                      + (st.selected.which===HOUSE ? "H"  : "S")
                      + ("00" + st.congress_selector.value).slice(-3)
                      + ("000" + row[2]).slice(-4);
    const url = "https://voteview.com/rollcall/" + vote_code;
    voteview.setAttribute("href", url);
    voteview.setAttribute("class", "voteview-link");
    voteview.innerHTML = "voteview>"
    button.appendChild(voteview);
}

function unexpand_button(button) {
    button.parentElement.style.borderWidth = "";
    button.parentElement.style.borderColor = "";
    button.style.height = "";
    button.style.backgroundColor = "";
    button.style.userSelect = "";
    const vote_n = Number(button.getAttribute("vote-number"));
    const row = st.selected.rollcalls[vote_n - 1];
    button.innerHTML = row[2].toString() + ". "
                        + (row[13].trim().length ?  "<span style='color: black;'>" + row[13].trim() + "</span><br>" : "")
                        + (row[15].trim().length ? row[15].trim() + "<br>" : "" )
                        + " <span style='color: #666666;'>" + row[16] + "</span>";

}

function voteClicked(event) {
    const button = event.currentTarget;
    reset_vote(st.selected);
    if (st.cur_button) {
        unexpand_button(st.cur_button);
    }
    var vote_n = Number(button.getAttribute("vote-number"));
    st.selected.vote = vote_n;
    st.cur_button = button;
    load_vote(st.selected, vote_n);
    expand_button(button, vote_n);
}

function congressSelected(event) {
    /* TODO: this caused a bug, but make sure all state is set up right. */
    st.cur_button = null;

    const congress_n = Number(event.target.value);
    load_congress(congress_n);
}

function setup_congress_selector(initial_congress_n) {
    const selector = document.querySelector("#select-congress")
    const n_congresses = 118;
    for (let i=1; i<n_congresses+1; i++) {
        const c = document.createElement("option");
        c.setAttribute("value", i.toString());
        const normal_endings = [ "th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
        const ordinal = i.toString() + (((i%100) >= 10 && (i%100) < 20 ) ? "th" : normal_endings[i % 10]);
        const start_year = 1789 + 2*(i-1);
        const end_year = start_year + 2;
        c.innerHTML = ordinal + " Congress (" + start_year.toString() + "-" + end_year.toString() + ")";
        selector.appendChild(c);
    }
    st.congress_selector = selector;
    selector.value = initial_congress_n.toString();
    selector.addEventListener("change", congressSelected);
}

function congress_main(rollcalls_str, votes_str, members_str, congress_n) {
    const rollcalls = parseCSV(rollcalls_str);
    st.rollcalls = rollcalls;
    const votes = parseCSV(votes_str);
    st.votes = votes;
    const members = parseCSV(members_str);

    st.chamber_svg = document.querySelector("#chamber");
    st.house = init_chamber(HOUSE, rollcalls, votes, members);
    st.senate = init_chamber(SENATE, rollcalls, votes, members);

    // Load whichever chamber is selected, on first run this is the House
    chamberSelected(null);

    const select_chamber = document.querySelector("#select-chamber");
    select_chamber.addEventListener("change", chamberSelected);

    load_vote(st.selected, st.selected.vote);

    if (!st.congress_selector) { // first run
        setup_congress_selector(congress_n);
    }

    window.onresize = reposition_label;
}

function load_congress(congress_n) {
    const rollcallsPromise = fetch(`data/HS${congress_n}_rollcalls.csv` ).then(response => response.text());
    const votesPromise = fetch(`data/HS${congress_n}_votes.csv`).then(response => response.text());
    const membersPromise = fetch(`data/HS${congress_n}_members.csv`).then(response => response.text());

    Promise.all([rollcallsPromise, votesPromise, membersPromise]).then(values => congress_main(...values, congress_n));
}

load_congress(116);

// prevent double click from annoyingly selecting text
document.addEventListener("mousedown", function(event) {
  if (event.detail > 1) {
    event.preventDefault();
  }
}, false);


/* 
Refs:
[1] https://stackoverflow.com/a/14991797/3137916
*/