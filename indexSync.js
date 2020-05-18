const request = require('request');
const colors = require('colors');
const http = require('http');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://192.168.0.1:12913/';
let successCount = 0;

// configs
const totalTests = 10;
const DEBUG = true;

main();

async function main() {
  //clear old downloaded videos
  clearOutPutDir();

  for (var i = 0; i < totalTests; i++) {
    try {
      await testStartRecord();
    } catch (e) {
      console.log(colors.red(e));
    }
  }
  console.warn('********************************');
  console.warn(
    '******Done testing ' + successCount + '/' + totalTests + ' *********'
  );
  console.warn('********************************');
}

// test 1 /startRecord
function testStartRecord() {
  return new Promise((resolve, reject) => {
    startRecord().then(
      res => {
        if (DEBUG) console.warn('startRecordSync resolved!', res);
        if (res.status == 'failed') {
          console.error('Test Failed: recording_init_failed');
          reject('recording_init_failed');
          return;
        } else {
          setTimeout(() => {
            getClips().then(
              async res => {
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
              err => {
                console.log(colors.red('test /startRecord:'), err);
                reject(err);
              }
            );
          }, 10 * 1000);
        }
      },
      err => {
        if (DEBUG) console.error(err);

        if (err == 'recording_init_failed') {
          reject(err);
          return;
        }
      }
    );
  });
}

function getClips() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'getClips', { json: true }, (err, res, body) => {
      if (err) {
        console.error(err);
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

function startRecord() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'startRecordSync', { json: true }, (err, res, body) => {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }

      if (body.error) {
        reject(body.error);
      } else {
        resolve(body);
      }
    });
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(
      process.env.PWD + '/output/' + url.split('/').pop()
    );
    var request = http
      .get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          if (DEBUG) console.log('Download complete');
          file.close();
          resolve();
        });
      })
      .on('error', function(err) {
        // Handle errors
        if (DEBUG) console.log(colors.red('Download error', err));
        fs.unlink(process.env.PWD + '/output/' + url.split('/').pop()); // Delete the file async. (But we don't check the result)
        reject(err);
      });
  });
}

function clearOutPutDir() {
  fs.readdir(process.env.PWD + '/output/', (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(process.env.PWD + '/output/', file), err => {
        if (err) throw err;
      });
    }
  });
}
