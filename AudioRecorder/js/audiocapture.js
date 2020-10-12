
var IS_MIC_ENABLED; 
var VOICENOTE_ID = 0;
var recorder;

var ALERT_MESSAGES = {
    RecordingTooShort: 'More than 6 seconds',
    NoMicAccess: "The device microphone is not enabled.",
    ReviewRecording: "Please review the recording. If not satisfied, you may re-record.<br />\n   When satisfied click save to finish.",
    CancelVNConfirm: "Are you sure ?",
    DeleteVNConfirm: "Are you sure?",
    AjaxError: 'There was a problem uploading'
};

var log = console.log.bind(console),
    id = function (val) { return document.getElementById(val); },
    ul = id('ul'),
    btnVoiceNotes = id('btnVoiceNotes'),
    start = id('btnStart'),
    stop = id('btnStop'),
    save = id('btnSave'),
    replay = id('btnPlayback'),
    remove = id('btnDelete'),
    cancel = id('btnCancelVn'), //This is the "cancel" link upper right
    progressBar = $('#progress-bar'), width = 0,
    recorder, 
    counter = 1,
    chunks,
    isMinLengthRecorded = false, //let's require  at least 6 seconds
timeOutIncr, //6 seconds min
elapsedTime = 0, //current time of recording in seconds
timeInerval = 0, //elapsed time interval
PBinterval = 0, //Progress Bar interval
isCancelClosed = false, isPlayBack = false, playBackTime = 0, media;
// #endregion ---------- GLOBAL VARS END  ---------- //

// #region ------------- EVENT SUBSCRIPTIONS START --------------------//

function initializeVoiceNoteEvent() {
    
    ul = id('ul');
    btnVoiceNotes = id('btnVoiceNotes');
    start = id('btnStart');
    stop = id('btnStop');
    save = id('btnSave');
    replay = id('btnPlayback');
    remove = id('btnDelete');
    cancel = id('btnCancelVn'); //This is the "cancel" link upper right
    progressBar = $('#progress-bar');
    //START EVENT
    start.onclick = function () {
        console.log(start.src);
        if (start.src.indexOf("record.png") != -1) {
            //If we have a playback going and they click to re-record a new note, we need to kill the playback.
            if (isMinLengthRecorded) {
                try {
                    var curVoiceNote = id('curVoiceNote');
                    curVoiceNote.pause(); //stop playback
                    curVoiceNote.src = null;
                    id('divTimeCount').innerHTML = "0.00";
                }
                catch (err) {
                    console.log("Error trying to pause voicenote playback: " + err + ".");
                }
            }
            isMinLengthRecorded = isCancelClosed = false;
            chunks = [];
            manageUIState(2 /* Recording */);
            recorder.start();
            startTimer();
        }
    };
    //STOP EVENT
    stop.onclick = function () {
        stopTimer();
        if (recorder.state != 'inactive')
            recorder.stop();
        if (isMinLengthRecorded) {
            manageUIState(3 /* Stopped */);
            playBackTime = elapsedTime; 
        }
        else {
            manageUIState(4 /* Stopped_Incomplete */);
        }
    };
    //CANCEL LINK CLICKED
    cancel.onclick = function () {
        console.log("isMinLengthRecorded:", isMinLengthRecorded);
        if (isMinLengthRecorded) {
            var rez = confirm("Cancel?");
           }
        else {
            cancelVNConfirmed();
        }
    };
    //PLAYBACK RECORDING
    replay.addEventListener("click", onReplayButtonClick);
    //SAVE RECORDING
    save.onclick = function () {
        uploadToApi();
    };
    //DELETE EVENT
    remove.addEventListener("click", onDeleteButtonClick);
    micCheck();
}
function initializeMediaHandler() {
    btnVoiceNotes.disabled = true;
    var mediaOptions = {
        video: {
            tag: 'video',
            type: 'video/webm',
            ext: '.mp4',
            gUM: { video: true, audio: true }
        },
        audio: {
            tag: 'audio',
            type: 'audio/mpeg',
            ext: '.mp3',
            gUM: { audio: true }
        }
    };
    media = mediaOptions.audio;
    navigator.mediaDevices.getUserMedia(media.gUM).then(function (rtnStream) {
        manageUIState(1 /* Initial */);
        recorder = new MediaRecorder(rtnStream);
        recorder.ondataavailable = function (e) {
            chunks.push(e.data);
            //if they cancel the window while recording, do not validate recording
            if (!isCancelClosed) {
                //Check for Min Length After the stop button is clicked
                if (recorder.state == 'inactive' && isMinLengthRecorded) {
                   
                    makeLink();
                }
                else {
                    alert(ALERT_MESSAGES.RecordingTooShort);
                    manageUIState(4 /* Stopped_Incomplete */);
                }
            }
        };
        // log('got media successfully');
    }).catch(function (err) {
        console.log(err.name + ": " + err.message);
        alert(ALERT_MESSAGES.NoMicAccess);
        manageUIState(0 /* No_Microphone */);
        IS_MIC_ENABLED = false;
    });
}
//START EVENT
start.onclick = function () {
    console.log(start.src);
    if (start.src.indexOf("record.png") != -1) {
        //If we have a playback going and they click to re-record a new note, we need to kill the playback.
        if (isMinLengthRecorded) {
            try {
                var curVoiceNote = id('curVoiceNote');
                curVoiceNote.pause(); //stop playback
                curVoiceNote.src = null;
                id('divTimeCount').innerHTML = "0.00";
            }
            catch (err) {
                console.log("Error trying to pause voicenote playback: " + err + ".");
            }
        }
        isMinLengthRecorded = isCancelClosed = false;
        chunks = [];
        manageUIState(2 /* Recording */);
        recorder.start();
        startTimer();
    }
};
//STOP EVENT
stop.onclick = function () {
    stopTimer();
    if (recorder.state != 'inactive')
        recorder.stop();
    if (isMinLengthRecorded) {
        manageUIState(3 /* Stopped */);
        playBackTime = elapsedTime; // 7491
    }
    else {
        manageUIState(4 /* Stopped_Incomplete */);
    }
};
//CANCEL LINK CLICKED
cancel.onclick = function () {
    console.log("isMinLengthRecorded:", isMinLengthRecorded);
    if (isMinLengthRecorded) {
        if (confirm(ALERT_MESSAGES.CancelVNConfirm)) {
            cancelVNConfirmed();
        }
    }
    else {
        cancelVNConfirmed();
    }
};
//PLAYBACK RECORDING
replay.addEventListener("click", onReplayButtonClick);
//SAVE RECORDING
save.onclick = function () {
    uploadToApi();
};
//DELETE EVENT
remove.addEventListener("click", onDeleteButtonClick);
// #endregion ------------- EVENT SUBSCRIPTIONS END --------------------//
//FUNCTIONS TO CHECK MIN VOICE NOTE LENGTH
function startTimer() {
    timeOutIncr = setTimeout(function () {
        isMinLengthRecorded = true;
    }, 6000);
    var minutes = 0;
    var seconds = 0;
    var maxLengthAllowed = 105;
    if (isPlayBack) {
        elapsedTime = 0;
        maxLengthAllowed = playBackTime;
        isMinLengthRecorded = true;
    }
    timeInerval = setInterval(function () {
        id('divTimeCount').innerHTML = minutes + "." + (seconds > 9 ? seconds : "0" + seconds);
        ;
        if (elapsedTime < maxLengthAllowed) {
            elapsedTime++;
            if (elapsedTime >= 60) {
                seconds = elapsedTime - 60;
                minutes = 1;
            }
            else {
                seconds = elapsedTime;
            }
        }
        else {
            stop.click(); //Stop the recording after 105 seconds
        }
    }, 1000);
}
function stopTimer() {
    clearTimeout(timeOutIncr);
    clearInterval(PBinterval);
    clearInterval(timeInerval);
}
function startProgress() {
    if (!isPlayBack) {
        elapsedTime = 0;
    }
    width = 0;
    progressBar.width(width);
    PBinterval = setInterval(function () {
        width += .95;
        progressBar.css('width', width + '%');
    }, 1000);
}
//IF WE HAVE A VALID (6 seconds min-length) VOICE NOTE RECORDED THIS GET CALLED
function makeLink() {
    alert(ALERT_MESSAGES.ReviewRecording);
    var blob = new Blob(chunks, { type: media.type }), url = URL.createObjectURL(blob), li = document.createElement('li'), mt = document.createElement(media.tag), hf = document.createElement('a'), fi = document.createElement('input');
    fi.setAttribute("type", "file");
    fi.src = url;
    mt.controls = true;
    mt.id = "curVoiceNote";
    mt.src = url;
    mt.style.display = 'none'; //This hides the audio file (playback) element
    //hf.href = url;
    //hf.download = `${counter++}${media.ext}`;
    li.appendChild(mt);
    li.appendChild(hf);
    if (ul.children.length > 0)
        ul.innerHTML = "";
    ul.style.textAlign = "center";
    ul.appendChild(li);
}
function removeVoiceNoteData() {
    manageUIState(6 /* Deleted */);
    isMinLengthRecorded = false;
    var curVoiceNote = id('curVoiceNote');
    //If we have an recorded voicenote
    if (curVoiceNote != null && !curVoiceNote.paused) {
        curVoiceNote.pause(); //stop playback if it's playing
        curVoiceNote.src = null;
    }
}
function onDeleteButtonClick() {
    if (confirm(ALERT_MESSAGES.DeleteVNConfirm)) {
        removeVoiceNoteData();
    }
}
function cancelVNConfirmed() {
    isCancelClosed = true;
    console.log("cancelVNConfirmed() isCancelClosed:", isCancelClosed);
    stop.click();
    removeVoiceNoteData();
    closeVoiceNotes();
}
function onReplayButtonClick() {
    id('curVoiceNote').play();
    isPlayBack = true;
    playBackTime = elapsedTime;
    startProgress();
    startTimer();
}
//This will maintain the UI state(buttons and images)
function manageUIState(uiState) {
    switch (uiState) {
        //WE CANNOT ACCESS THEIR MICROPHONE
        case 0 /* No_Microphone */:
            id('btnVoiceNotes').style.display = 'inline';
            id('btns').style.display = 'none';
            id('divUpload').style.display = 'none';
            break;
        //INITIAL DISPLAY OF UI
        case 1 /* Initial */:
            id('btns').style.display = 'inherit';
            start.removeAttribute('disabled');
            id('btnVoiceNotes').style.display = 'none';
            break;
        //START RECORDING
        case 2 /* Recording */:
            start.style.display = 'none'; //Hide start button
            stop.style.display = 'inline'; //Show Stop Button
            replay.style.display = 'none'; //Hide PLayback
            remove.style.display = 'none'; //Hide delete
            save.disabled = true;
            save.className = "process-btn-disabled";
            startProgress(); //progress bar 
            break;
        //RECORDING STOPPED BUT TOO SHORT
        case 4 /* Stopped_Incomplete */:
            id('divTimeCount').innerHTML = "0.00";
            progressBar.width(0);
            //re-enable recording button
            start.src = "images/record.png";
            start.removeAttribute('disabled');
            start.style.display = 'inline';
            stop.style.display = 'none';
            break;
        //RECORDING STOPPED
        case 3 /* Stopped */:
            start.style.display = 'inline';
            start.src = "images/record-disable.png";
            start.setAttribute('disabled', 'disabled');
            stop.style.display = 'none';
            replay.style.display = 'inline';
            remove.style.display = 'inline';
            replay.src = "images/play.png";
            remove.src = "images/delete.png";
            remove.addEventListener("click", onDeleteButtonClick);
            replay.addEventListener("click", onReplayButtonClick);
            //ENABLE save button
            save.removeAttribute('disabled');
            save.className = "process-btn";
            break;
        //DELETING RECORDING
        case 6 /* Deleted */:
            replay.style.display = 'inline';
            remove.style.display = 'inline';
            replay.src = "images/play-disable.png";
            remove.src = "images/delete-disable.png";
            remove.removeEventListener("click", onDeleteButtonClick);
            replay.removeEventListener("click", onReplayButtonClick);
            save.disabled = true;
            save.className = "process-btn-disabled";
            id('divTimeCount').innerHTML = "0.00";
            progressBar.width(0);
            //re-enable recording button
            start.src = "images/record.png";
            start.removeAttribute('disabled');
            if (isPlayBack) {
                progressBar.width(0);
                playBackTime = 0;
                isPlayBack = false;
                stopTimer();
            }
            break;
    }
}
//micrphone check 1964
function micCheck() {
    if (!navigator.mediaDevices) {
        // If we don't have a mediaDevices object (IE 11) then set the global var  to false.
        IS_MIC_ENABLED = false;
        return;
    }
    var constraints = { audio: true, video: false };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (audioStream) {
        if (audioStream) {
            IS_MIC_ENABLED = true;
        }
    })
        .catch(function (err) {
        IS_MIC_ENABLED = false;
        if (err.name == "NotFoundError") {
            alert(ALERT_MESSAGES.NoMicAccess);
        }
        else if (err.name == "NotAllowedError") {
            alert(ALERT_MESSAGES.NoMicAccess);
        }
        else {
            console.log('getUserMedia() error:', err);
            // I'm thinking that an end user arrives here, just show them the error in an alert
            // and perhaps they can screenshot it and send to TS. These errors are going to be impossible to repro 
            // but any helpful info they can give us is a plus.  For complete error state information see
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
            alert("Debug Info: " + err.name);
        }
        manageUIState(0 /* No_Microphone */);
    });
}
//This returns the user to the Prescription Options View
function closeVoiceNotes() {
    if (VOICENOTE_ID != 0) {
        $(document).triggerHandler("voiceNoteSaved");
    }
    else {
        $(document).triggerHandler("voiceNotesClosed");
    }
}

function uploadToApi() {
    var audioBlob = new Blob(chunks, { type: "audio/wav" });
    console.log("start uploading of:", audioBlob);
    var filename = "attempt" + counter + 1 + "" + media.ext;
    var formData = new FormData();

    //Attach the Audio File
    formData.append("audio_data", audioBlob, filename);
    //Send an Id
    formData.append("Id", "111111");  
 
    $.ajax({
        url: "api/audio/saveaudio",
        type: "POST",
        processData: false,
        contentType: false,
        dataType: 'json',
        data: formData,
        complete: function (retData, status) {
            if (status == 'success' || status == 'notmodified') {
                var noteId = $.parseJSON(retData.responseText);
                console.log("The returned audio ID is: " + audio);
            }
            else {
             //handletodo
            }
            save.disabled = true;
            save.className = "process-btn-disabled";
            removeVoiceNoteData();
            closeVoiceNotes();
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log("Ajax error: " + this.url + " : " + textStatus + " : " + errorThrown + " : " + XMLHttpRequest.statusText + " : " + XMLHttpRequest.status);
            $("#divFullSceenLoading").hide();
            if (XMLHttpRequest.status != 0 || errorThrown != "abort") {
                alert(ALERT_MESSAGES.AjaxError);
                save.style.display = 'inherit';
            }
        }
    });
}

function initAudio() {
    initializeMediaHandler();
    initializeVoiceNoteEvent();
}


