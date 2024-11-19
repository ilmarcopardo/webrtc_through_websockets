const signalingChannel = new WebSocket("ws://localhost:8765");
var pc = null;

function createPeerConnection(){
    var config = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
    pc = new RTCPeerConnection(config);
    
    // register some listeners to help debugging
    pc.addEventListener('icegatheringstatechange', () => {
        console.log("[GATHERING STATE]"+pc.iceGatheringState);
    });

    pc.addEventListener('iceconnectionstatechange', () => {
        console.log("[CONNECTION STATE]"+pc.iceConnectionState)
    });

    pc.addEventListener('signalingstatechange', () => {
        console.log("[SIGNALING STATE]"+pc.signalingState)
    });
    
    return pc;
}

async function waitForSignalingChannel(){
    if(signalingChannel.readyState===WebSocket.OPEN){
        return;
    }
    await new Promise((resolve)=>{
        signalingChannel.addEventListener('open', resolve);
    })
}

async function waitForIceGatheringComplete(){
    if (pc.iceGatheringState === 'complete'){
        return;
    }
    await new Promise ((resolve) => {
        function checkState(){
            if(pc.iceGatheringState === 'complete'){
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }
        }
        pc.addEventListener('icegatheringstatechange', checkState)
    })
}

async function makeCall(){
    // javascript should create the offer 
    var constraints = {
        audio: false,
        video: true
    }
    var localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.getTracks().forEach((track)=>{
        if(track.kind==="video"){
            pc.addTrack(track, localStream);
        }
    })
    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // need to wait until ice gathering state is complete
    await waitForIceGatheringComplete()

    offer = pc.localDescription;
    
    
    // now i need to send the offer over the signaling channel
    signalingChannel.send(JSON.stringify({
            'sdp': offer.sdp,
            'type': offer.type
        }
    ))
}


signalingChannel.addEventListener('message', async message => {
    answer = JSON.parse(message.data)
    var remoteDesc = new RTCSessionDescription({
        type: answer.type,
        sdp: answer.sdp
    });
    await pc.setRemoteDescription(remoteDesc);
});


waitForSignalingChannel()
pc = createPeerConnection();
makeCall();