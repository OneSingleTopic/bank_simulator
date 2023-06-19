
const app_ctn = document.getElementById("app_ctn");
const send_btn = document.getElementById("send_btn");
const receive_btn = document.getElementById("receive_btn");
const select_btn = document.getElementById("select_btn");
const amount_span = document.getElementById("amount_span");
const team_span = document.getElementById("team_span");
const form_send = document.getElementById("form_send_ctn");
const form_receive = document.getElementById("form_receive_ctn");

let displayed_number = 0;
let new_number = 0;
let handle = null;
let team = null;

function update_number() {
    const increment = 7137;
    if (Math.abs(displayed_number - new_number) == 0) {
        window.clearInterval(handle);
    }
    if (Math.abs(new_number - displayed_number) < 10 * increment) {
        displayed_number = new_number
    } else {
        displayed_number += Math.sign(new_number - displayed_number) * increment;
    }
    amount_span.innerText = displayed_number;
}

async function fetch_team() {
    try {
        const response = await fetch("/team");
        if (response.status != 200) {
            const error_msg = await response.json().message;
            throw new Error(error_msg)
        }
        const new_received_team = await response.json();
        team_span.innerText = new_received_team.name.charAt(0).toUpperCase() + new_received_team.name.slice(1);
        app_ctn.style.backgroundColor = new_received_team.bg_color;

        return new_received_team;
    } catch (err) {
        console.log("There was an error : " + err.message);
    }
}

function reset_select_btn() {
    select_btn.innerHTML = `
    <option value="choose_target" selected disabled>Choose target</option>
    <option value="bank">Bank</option>
    `
}

async function fetch_players() {
    try {
        const response = await fetch("/players");
        if (response.status != 200) {
            const error_msg = await response.json().message;
            throw new Error(error_msg)
        }
        const response_json = await response.json();
        return response_json.filter(player => player.name != team.name)

    } catch (err) {
        console.log("There was an error : " + err.message);
    }
}

async function update_target_players() {
    reset_select_btn();
    const players = await fetch_players();
    players.forEach(player => {
        const option = document.createElement("option");
        option.setAttribute("name", player.name);
        option.style.backgroundColor = player.bg_color;
        option.innerText = player.name.charAt(0).toUpperCase() + player.name.slice(1);
        select_btn.appendChild(option);
    })
}

async function config_socket() {
    team = await fetch_team();
    const socket = io();
    socket.emit("team", team.name);
    socket.on('new_number', (new_received_number) => {
        if (handle) {
            window.clearInterval(handle);
        }
        new_number = new_received_number;
        handle = window.setInterval(update_number, 2);
    });
    socket.on('players_change', update_target_players);
}

async function pay() {
    const formData = new FormData(form_send);

    try {
        const pay_post_answer = await fetch("/pay", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                payer: team.name,
                receiver: formData.get("receiver"),
                amount: formData.get("amount")
            })
        });

        const payload_json = await pay_post_answer.json();
        if (pay_post_answer.status != 200) {
            throw Error(payload_json.message);
        }
    } catch (error) {
        throw Error(error.message);
    }
}

async function receive() {
    const formData = new FormData(form_receive);

    try {
        const receive_post_answer = await fetch("/receive", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                receiver: team.name,
                amount: formData.get("amount")
            })
        });

        const payload_json = await receive_post_answer.json();
        if (receive_post_answer.status != 200) {
            throw Error(payload_json.message);
        }
    } catch (error) {
        throw Error(error.message);
    }
}

form_send.addEventListener("submit", event => {
    event.preventDefault();
    pay();
})

form_receive.addEventListener("submit", event => {
    event.preventDefault();
    receive();
})

config_socket();