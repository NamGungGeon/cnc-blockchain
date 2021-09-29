const io = require("socket.io-client");
const Peerjs = require("peerjs-nodejs");

const start = (socketAddr = "http://localhost:3000", peer = Peerjs()) => {
  peer.on("open", (myId) => {
    console.log("peer is opened", myId);
    //id는 peerjs 에서 사용할 고유 id

    const socket = io(socketAddr);
    socket.on("connect", () => {
      console.log("socket is connected");
    });
    socket.on("roomId", (roomId) => {
      console.log("roomId", roomId);

      // initSocket(socket, roomId);
      socket.emit("join-room", roomId, myId);
    });
    socket.on("user-list", (_users) => {
      console.log("on user-list");
      const users = JSON.parse(_users);
      console.log("current users", users);

      users.forEach((userId) => {
        if (userId === myId) return;

        const conn = peer.connect(userId);
        conn.serialization = "json";
        conn.on("open", () => {
          console.log("peer connected!", userId);
          conn.send({ msg: "handshake" });
        });
        conn.on("data", (data) => {
          console.log("peer: onData", data);
        });
        conn.on("close", () => {
          console.log("peer is disconnected", userId);
        });
      });
    });
    socket.on("user-connected", (newUserId) => {
      console.log("on user-connected");
      const conn = peer.connect(newUserId);
      conn.serialization = "json";
      conn.on("open", () => {
        console.log("peer connected!", newUserId);
        conn.send({ msg: "handshake" });
      });
      conn.on("data", (data) => {
        console.log("peer: onData", data);
      });
      conn.on("close", () => {
        console.log("peer is disconnected", newUserId);
      });
    });
    socket.on("disconnect", () => {
      console.log("socket is connected");
    });
  });
  peer.on("connection", function (conn) {
    conn.on("data", (msg) => {
      console.log("onData", data);
    });
  });
};

start();

module.exports = {
  joinNetwork: start,
};
