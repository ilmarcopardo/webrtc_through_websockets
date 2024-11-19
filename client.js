const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
const peerConnection = new RTCPeerConnection(configuration);
const signalingChannel = new WebSocket("ws://localhost:8765");

async function attachTracks(){
    const localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    localStream.getTracks().forEach(track => {
        if(track.kind==="video"){ peerConnection.addTrack(track, localStream); }
    });
}

async function makeCall(){
    // javascript should create the offer 
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await signalingChannel.send(JSON.stringify({'offer': offer}));
}

signalingChannel.addEventListener('open', async () => {
    // Once the signaling channel is open, we can proceed
    await attachTracks();
    await makeCall();
});

signalingChannel.addEventListener('message', async message => {
    answer = JSON.parse(message.data)
    if (answer["type"]==="answer") {
        const remoteDesc = new RTCSessionDescription({
            type: answer.type,
            sdp: answer.sdp
        });
        await peerConnection.setRemoteDescription(remoteDesc);
    }
});

peerConnection.addEventListener('connectionstatechange', event => {
    console.log(peerConnection.connectionState)
    if (peerConnection.connectionState === 'connected') {
        // Peers connected
        
    }
});

peerConnection.addEventListener('icegatheringstatechange', event =>{
    console.log(peerConnection.iceConnectionState)
})

peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate && event.candidate.candidate!="") {
        // Send the candidate data as JSON
        signalingChannel.send(JSON.stringify({
            'new-ice-candidate': {
                'sdpMid': event.candidate.sdpMid,
                'component': event.candidate.component,
                'foundation': event.candidate.foundation,
                'address': event.candidate.address,
                'port': event.candidate.port,
                'priority': event.candidate.priority,
                'protocol': event.candidate.protocol,
                'type': event.candidate.type,
                'relatedAddress': event.candidate.relatedAddress,
                'relatedPort': event.candidate.relatedPort,
                'sdpMLineIndex': event.candidate.sdpMLineIndex,
                'tcpType': event.candidate.tcpType
            }
        }));
    }
});

// Listen for remote ICE candidates and add them to the local RTCPeerConnection
signalingChannel.addEventListener('message', async message => {
    if (message.iceCandidate) {
        try {
            await peerConnection.addIceCandidate(message.iceCandidate);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
});


