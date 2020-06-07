const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const { ExternalTaskWorker } = require('@process-engine/consumer_api_client');

const IDENTITY = {
  token: 'ZHVtbXlfdG9rZW4=',
};

const PROCESS_ENGINE_URI = 'https://pe.kasten.pw';
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
  scriptOutput = '';
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


const executor = async (externalTask) => {
  const result = await uploadBackupToGDrive(externalTask.payload);

  return result;
};

const externalTaskWorker = new ExternalTaskWorker(PROCESS_ENGINE_URI, IDENTITY, TOPIC, MAX_TASKS, POLLING_TIMEOUT, executor);

externalTaskWorker.start();
