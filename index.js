const request = require('request');
const colors = require('colors');

const baseUrl = 'http://192.168.0.1:12913/';
let successCount = 0;

// configs
const totalTests = 10;
const DEBUG = false;

main();

async function main() {
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
        if (DEBUG) console.warn(res);
        if (res.status == 'failed') {
          console.error('Test Failed: recording_init_failed');
          reject('recording_init_failed');
          return;
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

    setTimeout(() => {
      getClips().then(
        res => {
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
          } else {
            console.warn(colors.red('test /startRecord: ✘'));
          }
          resolve();
        },
        err => {
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
        console.error(err);
        reject(err);
      }
      if (res.error) {
        reject(body.error);
      } else {
        resolve(body);
      }
    });
  });
}

function startRecord() {
  return new Promise((resolve, reject) => {
    request(baseUrl + 'startRecord', { json: true }, (err, res, body) => {
      if (err) {
        console.error(err);
        reject(err);
      }

      //after we start record verify no clips in the system
      setTimeout(() => {
        verifyTheresNoClipsInTheSystem().then(
          res => {
            if (res) {
              if (DEBUG) console.log('Tested for: No clips in the system ✔');
            } else {
              console.error('Test Failed');
              reject();
              return;
            }
          },
          e => {
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
