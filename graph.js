// app state
var st = {
    congress_selector: null,
    chamber_svg: null,
    // xx raw data, mostly for debugging
    rollcalls: null,
    votes: null,
    members: null,
    // processed: filtered and containing seat assignments
    house: null,
    senate: null,
    selected: null,
    house_vote: 2,
    senate_vote: 2,
    prevent_hover: false,
    over_seat: null,
    cur_button: null,
};

const HOUSE = 0;
const SENATE = 1;
const chamber_str = {
    [HOUSE]: "House",
    [SENATE]: "Senate",
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
};

// rollcall columns
const RC = {
    congress: 0,
    chamber: 1,
    rollnumber: 2,
    date: 3,
    session: 4,
    clerk_rollnumber: 5,
    yea_count: 6,
    nay_count: 7,
    nominate_mid_1: 8,
    nominate_mid_2: 9,
    nominate_spread_1: 10,
    nominate_spread_2: 11,
    nominate_log_likelihood: 12,
    bill_number: 13,
    vote_result: 14,
    vote_desc: 15,
    vote_question: 16,
    dtl_desc: 17,
};

// vote columns
const VT = {
    congress: 0,
    chamber: 1,
    rollnumber: 2,
    icspr: 3,
    cast_code: 4,
    prob: 5,
};

// member columns
const MEM = {
    congress: 0,
    chamber: 1,
    icspr: 2,
    state_icspr: 3,
    district_code: 4,
    state: 5,
    party_code: 6,
    occupancy: 7,
    last_means: 8,
    bioname: 9,
    bioguide_id: 10,
    born: 11,
    died: 12,
    nominate_dim1: 13,
    nominate_dim2: 14,
    nominate_log_likelihood: 15,
    nominate_geo_mean_probability: 16,
    nominate_number_of_votes: 17,
    nominate_number_of_errors: 18,
    conditional: 19,
    nokken_pool_dim1: 20,
    nokken_pool_dim2: 21,
    first_vote: 22,
    last_vote: 23
};


/************************************** Utility ***************************************************/

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

function degcos(deg) {
  return Math.cos(deg * Math.PI / 180);
}

function degsin(deg) {
    return Math.sin(deg * Math.PI / 180);
}

function degatan2(y, x) {
  return (Math.atan2(y, x)*180) / Math.PI;
}

function xy_in_rect(x, y, rect) {
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

/************************************** Chamber ***************************************************/

function filter_chamber(table, which_chamber) {
    var result = []
    for (var i=0; i<table.length; i++) {
        var row = table[i];
        // chamber is column 1 for all row types(rollcalls, votes, and members)
        if (row[MEM.chamber] === chamber_str[which_chamber]) {
            result.push(row);
        }
    }
    return result;
}
// Returns: sorted array of svg elements in the proper layout, but not assigned
function chamber_seats(which_chamber, how_many) {
    var svg = document.querySelector("#chamber");
    svg.setAttribute("viewBox", "0 0 800 450");
    const svgWidth = 800;
    const svgHeight = 450;
    if (which_chamber == HOUSE) {
        var rows = [ 22, 25, 31, 34, 38, 41, 43, 45, 47, 53, 56];
        var c_r = 7.5;
        var d_r = 22;
        var r = 130;
    } else {
        var rows = [ 16, 18, 20, 22, 24 ];
        c_r = 14;
        var d_r = 40;
        var r = 170;
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
            circle.setAttribute("class", "seat");
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

/* TODO: move seat assignment to pre-processing */

function house_seat_groups(members) {
    var districts = {};
    var seat_groups = [];
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "House") {
            var member = members[i];
            if (member[4] == 0) {
                // non voting
                console.assert(["VI", "PR", "MP", "GU", "DC", "AS"].includes(member[MEM.state]));
                continue;
            } else {
                var district_code = member[MEM.state]+member[MEM.district_code].toString();
                var group;
                if (districts[district_code]) {
                    group = districts[district_code];
                    group.push(member);
                    // sort by reverse time served(last vote - first vote)
                    group.sort((b, a) =>
                        (Number(a[MEM.last_vote])-Number(a[MEM.first_vote]))
                        -(Number(b[MEM.last_vote])-Number(b[MEM.first_vote])));
                } else {
                    group = [member];
                    districts[district_code] = group;
                    seat_groups.push(group);
                }
            }
        }
    }
    // sort by reverse ideology score(conservative -> liberal) of the longest serving member
    seat_groups.sort((b, a) => a[0][MEM.nominate_dim1]-b[0][MEM.nominate_dim1]);
    return seat_groups;
}

function senate_seat_groups(members) {
    var states = {};
    for (var i=0; i<members.length; i++) {
        if (members[i][1] === "Senate") {
            var member = members[i];
            var icspr = member[MEM.icspr];
            var state = member[MEM.state];
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
        state.sort((b, a) => (Number(b[MEM.first_vote])-Number(a[MEM.first_vote])));
        var groupA = [state[0]];
        var groupA_indices = [0];
        var groupA_i = 0;
        // Add senators who start immediately after the first senator finishes
        // to the same seat group, "group A". Group B is everyone not in group A.
        for (let j=1; j<state.length; j++) {
            if (Number(state[j][MEM.first_vote])>=Number(groupA[groupA_i][MEM.last_vote])) {
                groupA.push(state[j]);
                groupA_indices.push(j);
                groupA_i += 1;
            }
        }
        for (let j=groupA_indices.length-1; j>= 0 ; j--) {
            state.splice(groupA_indices[j], 1);
        }
        // sort by reverse time served(last vote - first vote)
        groupA.sort((b, a) =>
            (Number(a[MEM.last_vote])-Number(a[MEM.first_vote]))
            -(Number(b[MEM.last_vote])-Number(b[MEM.first_vote])));
        state.sort((b, a) =>
            (Number(a[MEM.last_vote])-Number(a[MEM.first_vote]))
            -(Number(b[MEM.last_vote])-Number(b[MEM.first_vote])));
        seat_groups.push(groupA);
        if (state.length) {
            seat_groups.push(state);
        } else {
            // PA only had one senator in the 2nd Congress
            console.log(`No second senator found in ${groupA[0][MEM.state]}`);
        }
    }
    seat_groups.sort((b, a) => a[0][MEM.nominate_dim1]-b[0][MEM.nominate_dim1]);
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
            result[mem[MEM.icspr]] = {
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
        var seat_groups = house_seat_groups(members);
    } else {
        var seat_groups = senate_seat_groups(members);
    }

    chamber.seats = chamber_seats(which_chamber, seat_groups.length);

    chamber.members = assign_seats(seat_groups, chamber.seats);

    chamber.votes = filter_chamber(votes, which_chamber);

    chamber.rollcalls = filter_chamber(rollcalls, which_chamber);

    return chamber;
}

function draw_chamber(chamber) {
    var svg = document.querySelector("#chamber");
    document.addEventListener("mousemove", chamber_mousemove);
    document.addEventListener("mousedown", chamber_mousedown);
    svg.innerHTML = "";
    for (var i=0; i<chamber.seats.length; i++) {
        svg.appendChild(chamber.seats[i]);
    }
}

function dist(x1, y1, x2, y2) {
    return ((x2-x1)**2 + (y2-y1)**2)**0.5;
}

function close_popup() {
    st.over_seat.setAttribute("stroke-width", "1");
    st.over_seat.setAttribute("stroke", "#000");
    st.over_seat = null;
    const popup = document.getElementById("member-popup");
    popup.setAttribute("persist", "false");
    popup.style.visibility = "hidden";
}

function show_member_popup(seat_el, persist) {
    if (st.over_seat) {
        st.over_seat.setAttribute("stroke-width", "1");
        st.over_seat.setAttribute("stroke", "#000");
    }
    const rect = seat_el.getBoundingClientRect();
    const elem_x = rect.x;
    const elem_y = rect.y;
    const no_hit_r = 0;
    const popup = document.querySelector("#member-popup");
    const parent_rect = popup.parentNode.getBoundingClientRect();
    const parent_x = parent_rect.x;
    const parent_y = parent_rect.y;
    popup.style.visibility = "visible";
    const r = (rect.width / 2);
    const off_x = (r - 2) * Math.cos(Math.PI / 3);
    const off_y = (r - 2) * Math.sin(Math.PI / 3);
    popup.style.left = Math.round(elem_x + r + off_x - parent_x)+"px";
    popup.style.top = Math.round(elem_y + r - off_y - popup.clientHeight-parent_y)+"px";
    const icspr = seat_el.getAttribute("icspr");
    const member = st.selected.members[icspr];
    if (persist) {
        popup.setAttribute("persist", "true");
        seat_el.setAttribute("stroke", "#0ff");
        seat_el.setAttribute("stroke-width", "1");
    } else {
        popup.setAttribute("persist", "false");
        seat_el.setAttribute("stroke", "#000");
    }
    if (!member) { // XXX see load_vote
        popup.innerHTML = "Unknown member";
    } else {
        popup.innerHTML = member.member[MEM.bioname];
    }
    st.over_seat = seat_el;
}

function reset_vote(chamber) {
    for (var i=0; i<chamber.seats.length; i++) {
        chamber.seats[i].setAttribute("icspr", "-1");
        chamber.seats[i].setAttribute("fill", "#888888");
    }
``}

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
            text = "(";
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
                text = text.slice(0, -2) + ")";
            } else {
                text = text + "O: " + n_others.toString() + ")";
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

    reposition_label();
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
        if (chamber.votes[i][VT.rollnumber] == rollnum) {
            var vote = chamber.votes[i];
            var icspr = Math.floor(Number(vote[VT.icspr])).toString();
            var member = chamber.members[icspr];
            if (!member) {
                // Sometimes a president's vote is listed as a vote
                // in one of the chambers.
                i += 1;
                continue;
            }
            // Congress 116 (at least) stores vote codes as string floats, e.g. "6.0"
            icspr_votes[icspr] = Math.floor(Number(vote[VT.cast_code]));
        }
    }
    var vote_cmp = { yea: { }, nay: { }, skip: { }};
    var misses = 0;
    // Find members who were in office for this vote but might not be explicitly listed
    for(const [icspr, member] of Object.entries(chamber.members)) {
        if (rollnum < member.member[MEM.first_vote]|| rollnum > member.member[MEM.last_vote]) {
            // presumably not in office at the time of the vote
            continue;
        }
        var seat = member.seat;
        if (seat) {
            var party_code = member.member[MEM.party_code];
            var vote_code = icspr_votes[icspr] ? vote_codes[icspr_votes[icspr]] : vote_codes[100];
            var fill = vote_colors[vote_code][party_code] ? vote_colors[vote_code][party_code]
                : vote_colors[vote_code][328];
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

// This handles mouse moves for the whole document. That way it can remove the popup when necessary
// even if the move is outside the chamber rect.
function chamber_mousemove(event) {
    const elem = event.target;
    const popup = document.querySelector("#member-popup");
    if (elem.tagName === "circle" && elem.getAttribute("class") == "seat") {
        const elem_r = Number(elem.getAttribute("r"));
        if (!(elem == st.over_seat) && popup.getAttribute("persist")!=="true" && !st.prevent_hover) {
            show_member_popup(elem, false);
        }
    } else if (elem !== popup) {
        if (st.over_seat && popup.getAttribute("persist")!=="true") {
            close_popup();
        }
    }
}

function chamber_mousedown(event) {
    const popup = document.querySelector("#member-popup");
    const rect = st.chamber_svg.getBoundingClientRect();
    if (event.target !== popup && st.over_seat && xy_in_rect(event.clientX, event.clientY, rect)) {
        const cls = event.target.getAttribute("class");
        // prevent immediately closing after the click that opens a popup with
        // member_search_result_chosen
        if (cls==="search-members-result" || cls==="seat") {
            const icspr = event.target.getAttribute("icspr");
            if (icspr && st.over_seat && icspr === st.over_seat.getAttribute("icspr")) {
                return;
            }
        }
        close_popup();
    }
}

function reposition_label() {
    const all = document.querySelector("#vote-summary");
    const normal_w = 800;
    const normal_size = 0.85;
    const rect = st.chamber_svg.getBoundingClientRect();
    const svg_w = rect.width;
    const svg_h = rect.height;
    all.style.fontSize = (normal_size * (svg_w/normal_w)).toString() + "rem";
    // XXX get the new width given updated fontSize
    const w = all.clientWidth;
    all.style.top = (0.80 * svg_h).toString() + "px";
    all.style.left = (0.5 * svg_w - 0.5*w).toString() + "px";
}

function resize_chamber() {
    const search_members_input = document.getElementById("search-members-input");
    const remain = document.getElementById("chamber-box").getBoundingClientRect().right
        - document.getElementById("select-chamber").getBoundingClientRect().right;
    console.log(remain);
    if (remain < 300) {
        search_members_input.style.width = Math.round(remain).toString() + "px";
    } else {
        search_members_input.style.width = "300px";
    }

    reposition_label();
}

function my_scroll_into_view(el, container)
{
    er = el.getBoundingClientRect();
    cr = container.getBoundingClientRect();
    if (er.top < cr.top) {
        container.scrollTo({ top: er.top - cr.top + container.scrollTop, left: 0, behavior: "instant"});
    } else if (er.bottom > cr.bottom) {
        container.scrollTo({ top: er.bottom - cr.bottom + container.scrollTop, left: 0, behavior: "instant"});
    }
}

function select_member_result(el)
{
    const results_box = el.parentNode;
    const old_i = results_box.getAttribute("sel-index");
    if (old_i.length !== 0) {
        old_el = results_box.children[Number(old_i)];
        old_el.style.backgroundColor = "#fff";
    }
    results_box.setAttribute("sel-index", Number(el.getAttribute("i")));
    results_box.setAttribute("sel-icspr", Number(el.getAttribute("icspr")));
    el.style.backgroundColor = "#ddd";
    my_scroll_into_view(el, results_box);
}

function member_search_result_chosen(el) {
    const input_box = document.getElementById("search-members-input");
    input_box.value = "";
    input_box.blur();
    /*
    const results_box = document.getElementById("search-members-results");
    results_box.style.visibility = "hidden";
    */

    show_member_popup(st.selected.members[Number(el.getAttribute("icspr"))].seat, true);
}

function search_members(ev)
{
    const query = ev.target.value;
    const results_box = document.getElementById("search-members-results");
    let results = [];
    if (query) {
        results_box.innerHTML = "";
        let i = 0;
        for(const [icspr, member] of Object.entries(st.selected.members)) {
            if (member.member[9].toLowerCase().includes(query.toLowerCase())) {
                const r = document.createElement("div");
                r.setAttribute("class", "search-members-result");
                r.setAttribute("icspr", member.member[2]);
                r.setAttribute("i", i);
                r.innerHTML = member.member[9];
                r.addEventListener("mouseenter", (e) => select_member_result(e.target));
                r.addEventListener("mousedown", (e) => member_search_result_chosen(e.target));
                results_box.appendChild(r);
                i++;
            }
        }
        results_box.style.visibility = "visible";
        if (results_box.children.length > 0) {
            results_box.setAttribute("sel-index", "");
            results_box.setAttribute("sel-icspr", "");
            select_member_result(results_box.children[0]);
        }
    } else {
        results_box.style.visibility = "hidden";
        results_box.setAttribute("sel-index", "");
        results_box.setAttribute("sel-icspr", "");
    }
}

function search_members_input_keydown(ev) {
    const results_box = document.getElementById("search-members-results");
    const sel_i = results_box.getAttribute("sel-index");
    let next_sel_i = -1;
    if (ev.key === "Enter") {
        if (sel_i && sel_i.length > 0) {
            member_search_result_chosen(results_box.children[Number(sel_i)]);
        }
    } else if (ev.key == "ArrowDown") {
        if (sel_i && sel_i.length > 0) {
            next_sel_i = Number(sel_i) == results_box.children.length - 1? 0 : Number(sel_i) + 1;
        }
    } else if (ev.key == "ArrowUp") {
        if (sel_i && sel_i.length > 0) {
            next_sel_i = Number(sel_i) == 0 ? results_box.children.length - 1: Number(sel_i) - 1;
        }
    }
    if (next_sel_i >= 0) {
        select_member_result(results_box.children[next_sel_i]);
        ev.preventDefault();
    }
}

/************************************** Rollcall table ********************************************/

function rollcall_matches(row, query) {
    if (!query) {
        return true;
    }
    const search_text = row[13] + row[15] + row[16] + row[17];
    return search_text.toLowerCase().includes(query.toLowerCase());
}

function rollcall_table(rollcalls, which_chamber, query) {
    const chamber_str = which_chamber === HOUSE ? "House" : "Senate";
    const tbl = document.querySelector("#rollcalls");
    tbl.innerHTML = "";
    for (var i=0; i<rollcalls.length; i++) {
        var row = rollcalls[i];
        if (row[RC.chamber]===chamber_str && rollcall_matches(row, query)) {
            var tr = tbl.appendChild(document.createElement("tr"));
            // var td = tr.appendChild(document.createElement("td"));
            var button = tr.appendChild(document.createElement("div"));
            button.style.width = "100%";
            button.setAttribute("class", "vote-button");
            button.setAttribute("vote-number", row[RC.rollnumber].toString());
            button.addEventListener("click", voteClicked);
            button.innerHTML = row[RC.rollnumber].toString() + ". "
                               + (row[RC.bill_number].trim().length ?  "<span style='color: black;'>" + row[RC.bill_number].trim() + "</span><br>" : "")
                               + (row[RC.vote_desc].trim().length ? row[RC.vote_desc].trim() + "<br>" : (row[RC.dtl_desc].trim().length ? row[RC.dtl_desc].trim() + "<br>" : "") )
                               + " <span style='color: #666666;'>" + row[RC.vote_question] + "</span>";
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
    voteview.setAttribute("target", "_blank");
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
    button.innerHTML = row[RC.rollnumber].toString() + ". "
                       + (row[RC.bill_number].trim().length ?  "<span style='color: black;'>" + row[RC.bill_number].trim() + "</span><br>" : "")
                       + (row[RC.vote_desc].trim().length ? row[RC.vote_desc].trim() + "<br>" : (row[RC.dtl_desc].trim().length ? row[RC.dtl_desc].trim() + "<br>" : "") )
                       + " <span style='color: #666666;'>" + row[RC.vote_question] + "</span>";
}

function voteClicked(event) {
    const button = event.currentTarget;
    if (st.cur_button === button) {
        return;
    }
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

/************************************** Selections/main *******************************************/

/* All of this is to prevent hover from being active when chamber/congress selectors are open */
function chamberCongressSelectorOpened(event) {
    st.prevent_hover = true;
}

function chamberCongressSelectorClosed(event) {
    st.prevent_hover = false;
}

function chamberSelected(event) {
    const select_chamber = document.querySelector("#select-chamber");
    var chamber = select_chamber.value=="House" ? st.house : st.senate;
    st.cur_button = null;
    st.selected = chamber;
    draw_chamber(chamber);
    // xx load current search-box query?
    rollcall_table(chamber.rollcalls, chamber.which, "");
    load_vote(chamber, chamber.vote);
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
    selector.addEventListener("focus", chamberCongressSelectorOpened);
    selector.addEventListener("blur", chamberCongressSelectorClosed);
}

function search_rollcalls(ev)
{
    const query = ev.target.value;
    rollcall_table(st.selected.rollcalls, st.selected.which, query);
}

function setup_search_bars()
{
    const search_members_input = document.getElementById("search-members-input");
    search_members_input.addEventListener("input", search_members);
    search_members_input.addEventListener("focus", search_members);
    search_members_input.addEventListener("blur", (event)=>{
        const results_box = document.getElementById("search-members-results");
        results_box.style.visibility = "hidden";
    });
    search_members_input.addEventListener("keydown", search_members_input_keydown);

    const search_rollcalls_input = document.getElementById("search-rollcalls-input");
    search_rollcalls_input.addEventListener("input", search_rollcalls);
}


function congress_main(rollcalls_str, votes_str, members_str, congress_n) {
    if (st.over_seat) {
        close_popup();
    }
    const rollcalls = parseCSV(rollcalls_str);
    st.rollcalls = rollcalls;
    const votes = parseCSV(votes_str);
    st.votes = votes;
    const members = parseCSV(members_str);
    st.members = members;

    st.chamber_svg = document.querySelector("#chamber");
    st.house = init_chamber(HOUSE, rollcalls, votes, members);
    st.senate = init_chamber(SENATE, rollcalls, votes, members);

    // Load whichever chamber is selected, on first run this is the House
    chamberSelected(null);

    const select_chamber = document.querySelector("#select-chamber");
    select_chamber.addEventListener("change", chamberSelected);
    select_chamber.addEventListener("focus", chamberCongressSelectorOpened);
    select_chamber.addEventListener("blur", chamberCongressSelectorClosed);

    load_vote(st.selected, st.selected.vote);

    setup_search_bars();

    if (!st.congress_selector) { // first run
        setup_congress_selector(congress_n);
    }
}

function load_congress(congress_n) {
    const rollcallsPromise = fetch(`data/HS${congress_n}_rollcalls.csv` ).then(response => response.text());
    const votesPromise = fetch(`data/HS${congress_n}_votes.csv`).then(response => response.text());
    const membersPromise = fetch(`data/HS${congress_n}_members_v2.csv`).then(response => response.text());

    Promise.all([rollcallsPromise, votesPromise, membersPromise]).then(values => congress_main(...values, congress_n));
}

function handle_resize(event) {
    const chamber_box = document.getElementById("chamber-box");
    const rollcalls_box = document.getElementById("rollcalls-box");
    const w2 = 1720;
    const w1 = 1300;
    const chamber_p = .62;
    const rollcalls_p = .20;
    const both_p = chamber_p + rollcalls_p;
    const padding_p = 1 - chamber_p - rollcalls_p;
    const gap = 10;
    const wprime = window.innerWidth - gap;
    if (wprime > w2) {
        // full padding above w2
        chamber_box.style.width = "64vw";
        rollcalls_box.style.width = "18vw";
    } else if (wprime > w1) {
        // padding scales down between w2 and w1
        const padding = ((wprime - w1) / (w2 - w1)) * padding_p * window.innerWidth;
        const chamber_w = (wprime - padding) * (chamber_p / both_p);
        chamber_box.style.width = Math.round(chamber_w).toString() + "px";
        const rollcalls_w = (wprime - padding) * (rollcalls_p / both_p);
        rollcalls_box.style.width = Math.round(rollcalls_w).toString() + "px";
    } else {
        // no padding below w1
        chamber_box.style.width = Math.round((chamber_p/both_p)*wprime).toString() + "px";
        rollcalls_box.style.width = Math.round((rollcalls_p/both_p)*wprime).toString() + "px";
    }
    resize_chamber();
}

window.addEventListener("resize", handle_resize);

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