const exec = require('child_process').exec;
const path = require('path');

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

async function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdin, stderr) => {
      if (err || stderr) {
        reject(err, stderr);
      }

      return resolve(stdin);
    });
  });
}

function createExternalTaskWorker(url) {
  const httpClient = new HttpClient();
  httpClient.config = {url: url};
  
  const externalAccessor = new ExternalTaskApiExternalAccessor(httpClient);
  const externalTaskAPIService = new ExternalTaskApiClientService(externalAccessor);
  const externalTaskWorker = new ExternalTaskWorker(externalTaskAPIService);

  return externalTaskWorker;
}

async function uploadBackupToGDrive(payload) {
  const griveFolderPath = path.join(__dirname, '..', 'Google_Drive');
  const commandResult = await execCommand(`cd ${griveFolderPath} && pwd && grive -s server_backups`);

  const result = { 
    output: commandResult
  };

  console.log('Done!');

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
