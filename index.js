const request = require('request');
const colors = require('colors');
const http = require('http');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://192.168.0.1:12913/';
let successCount = 0;

// configs
const totalTests = 10;
const DEBUG = false;
var sessionId = '';

var pwd = process.platform === 'win32' ? process.cwd() : process.env.PWD;

main();

async function main() {
  //clear old downloaded videos
  clearOutPutDir();

  for (var i = 0; i < totalTests; i++) {
    try {
      //startStream
      if (DEBUG) console.warn('startStream..');
      await startStream();
      //wait 20 seconds
      if (DEBUG) console.warn('startStream..Sleep 20');
      await sleep(20);
      //stopStream
      if (DEBUG) console.warn('stopStream');
      await stopStream();

      //wait 10 seconds
      await sleep(10);

      await testDownloadClip();
      await sleep(80);
    } catch (e) {
      console.log(e);
    }
  }
  console.warn('********************************');
  console.warn(
    '******Done testing ' + successCount + '/' + totalTests + ' *********'
  );
  console.warn('********************************');
}

// test 1 /startRecord
function testDownloadClip() {
  console.log('|| > testDownloadClip');
  return new Promise((resolve, reject) => {
    startRecord().then(
      (res) => {
        if (DEBUG) console.warn('|| > startRecord', res);
        if (res.status == 'failed') {
          if (DEBUG) console.error('Test Failed: recording_init_failed');
          reject('recording_init_failed');
          return;
        } else {
          resolve();
        }
      },
      (err) => {
        if (DEBUG) console.error('|| > startRecord ERR', err);

        if (err == 'recording_init_failed') {
          console.error('====RECOVER=====');
          //recover from fail..
          startRecord().then(
            (res) => {
              if (DEBUG) console.warn(res);
              if (res.status == 'failed') {
                if (DEBUG) console.error('Test Failed: recording_init_failed');
                reject('recording_init_failed');
                return;
              } else {
                resolve();
              }

              listenForGetClips().then(
                (res) => resolve(err),
                (err) => console.error(err)
              );
            },
            (err) => {
              if (DEBUG) console.error(err);

              if (err == 'recording_init_failed') {
                reject(err);
                return;
              }
            }
          );
        }
      }
    );

    listenForGetClips().then(
      (res) => resolve(res),
      (err) => console.error(err)
    );
  });
}

function listenForGetClips() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      getClips().then(
        async (res) => {
          if (res['error']) {
            console.log(colors.red('test /startRecord: ✘'), res['error']);
            reject(res['error']);
            return;
          }

          if (res['clips'][0].url) {
            successCount++;
          }
          if (res['clips'][0].url) {
            console.warn(colors.green('test /startRecord: ✔'));
            console.log(colors.yellow(res['clips'][0].url));
            try {
              await downloadFile(res['clips'][0].url);
            } catch (e) {
              console.log(colors.red('Download Failed'));
              return;
            }
          } else {
            console.warn(colors.red('test /startRecord: ✘'));
          }
          resolve();
        },
        (err) => {
          console.log(colors.green('test /startRecord:'), err);
          reject(err);
        }
      );
    }, 70000);
  });
}

function getClips() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'getClips', { json: true }, (err, res, body) => {
      if (err) {
        if (DEBUG) console.error(err);
        reject(err);
      }
      if (body && body.error) {
        reject(body.error);
      } else {
        resolve(body);
      }
    });
  });
}

function startStream() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'startStream', { json: true }, (err, res, body) => {
      if (err) {
        if (DEBUG) console.error(err);
        reject(err);
      }

      if (body && body.error) {
        if (DEBUG) console.error(body);
        reject(body.error);
      } else {
        if (DEBUG) console.log(body);
        sessionId = body.sessionId;
        resolve(body);
      }
    });
  });
}
function stopStream() {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: baseUrl + 'stopStream',
        headers: {
          SessionId: sessionId,
        },
        method: 'GET',
      },
      (err, res, body) => {
        if (err) {
          if (DEBUG) console.error(err);
          reject(err);
        }
        if (DEBUG) console.log('stop stream', 'xxxx: ' + sessionId, body);
        if (body && body.error) {
          reject(body.error);
        } else {
          sessionId = body.sessionId;
          resolve(body);
        }
      }
    );
  });
}

function startRecord() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'startRecord', { json: true }, (err, res, body) => {
      if (err) {
        if (DEBUG) console.error('startRecord', err);
        reject(err);
        return;
      }

      //after we start record verify no clips in the system
      setTimeout(() => {
        verifyTheresNoClipsInTheSystem().then(
          (res) => {
            if (res) {
              if (DEBUG) console.log('Tested for: No clips in the system ✔');
            } else {
              console.error('Test Failed');
              reject();
              return;
            }
          },
          (e) => {
            console.error('Test Failed');
            console.error(e);
            reject();
            return;
          }
        );
      }, 10 * 1000);

      if (body.error) {
        reject(body.error);
      } else {
        resolve(body);
      }
    });
  });
}

function verifyTheresNoClipsInTheSystem() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'getClips', { json: true }, (err, res, body) => {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      if (res.error) {
        reject(body.error);
      } else {
        if (body.error == 'no_dir') {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(pwd + '/output/' + url.split('/').pop());
    var request = http
      .get(url, function (response) {
        var startTime = null;
        response.on('data', function (chunk) {
          if (!startTime) {
            startTime = new Date().getTime();
          }
        });

        response.on('end', function () {
          var len = parseInt(response.headers['content-length'], 10) / 1048576; //1048576 - bytes in  1Megabyte
          var endTime = new Date().getTime();
          console.log(
            'download complete, Time: ',
            (endTime - startTime) / 1000,
            'len: ',
            len,
            'speed: ',
            len / ((endTime - startTime) / 1000),
            'mb/s'
          );
        });

        response.pipe(file);
        file.on('finish', function () {
          if (DEBUG) console.log('Download complete');
          file.close();
          resolve();
        });
      })

      .on('error', function (err) {
        // Handle errors
        if (DEBUG) console.log(colors.red('Download error', err));
        fs.unlink(pwd + '/output/' + url.split('/').pop()); // Delete the file async. (But we don't check the result)
        reject(err);
      });
  });
}

function clearOutPutDir() {
  fs.readdir(pwd + '/output/', (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(pwd + '/output/', file), (err) => {
        if (err) throw err;
      });
    }
  });
}

function sleep(seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}
