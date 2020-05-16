const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const {HttpClient} = require('@essential-projects/http');
const {
  ExternalTaskApiClientService,
  ExternalTaskApiExternalAccessor,
  ExternalTaskWorker,
} = require('@process-engine/external_task_api_client');

const {ExternalTaskFinished} = require('@process-engine/external_task_api_contracts');

const identity = {
  token: 'ZHVtbXlfdG9rZW4=',
};

const TOPIC = 'UPLOAD_BACKUP';
const MAX_TASKS = 10;
const POLLING_TIMEOUT = 1000;

let scriptOutput = "";

function createExternalTaskWorker(url) {
  const httpClient = new HttpClient();
  httpClient.config = {url: url};

  const externalAccessor = new ExternalTaskApiExternalAccessor(httpClient);
  const externalTaskAPIService = new ExternalTaskApiClientService(externalAccessor);
  const externalTaskWorker = new ExternalTaskWorker(externalTaskAPIService);

  return externalTaskWorker;
}

function log(text) {
  console.log(text);
  scriptOutput += `\n${text}`;
}

async function uploadBackupToGDrive(payload) {
  const backupFolderPath = path.join(__dirname, '..', 'cloud_backups');
  const files = fs.readdirSync(backupFolderPath, {encoding: 'utf8'});

  const promises = [];
  files.forEach((file) => {
    const copyPromise = new Promise((resolve, reject) => {
      const timeStart = performance.now()
      log(`Start copy ${backupFolderPath}/${file} to google drive`);

      exec(`cp -f ${backupFolderPath}/${file} ~/drive/server_backups`, ((error, stdout, stderr) => {
        if (error || stderr) {
          log(error || stderr);
          log(`Copy operation failed for ${backupFolderPath}/${file}`);
          reject(error || stderr);
        }

        const timeStop = performance.now()
        log(`Copied ${backupFolderPath}/${file} to ~/drive/server_backups in ${Math.floor(timeStop - timeStart)} ms.`)
        log(stdout);
        resolve(stdout);
      }));
    });

    promises.push(copyPromise);
  });

  await Promise.all(promises);

  const result = {
    output: scriptOutput
  };

  return result;
};

async function main() {
  const externalTaskWorker = createExternalTaskWorker('https://pe.kasten.pw');

  console.log(`Waiting for tasks with topic '${TOPIC}'.`);

  externalTaskWorker.waitForAndHandle(identity, TOPIC, MAX_TASKS, POLLING_TIMEOUT, async (externalTask) => {
    console.log('ExternalTask data: ');
    console.log(externalTask);
    console.log('');

    const result = await uploadBackupToGDrive(externalTask.payload);
    const externalTaskFinished = new ExternalTaskFinished(externalTask.id, result);

    return externalTaskFinished;
  });
}

main();
