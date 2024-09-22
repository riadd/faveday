
const API_KEY = 'AIzaSyAjRfgpPKdiUDe0Q_edY8WaSCNNUPI5b7c';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const CLIENT_ID = '795336711146-uv48inhi4397o4b6uo2oq1of1s81glo9.apps.googleusercontent.com';

// This function is called when the page loads
function onAppStart() {
  console.log("OnAppStart!");

  // gapi.client.init({
  //   'apiKey': 'AIzaSyAjRfgpPKdiUDe0Q_edY8WaSCNNUPI5b7c',
  //   'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  // })
  //

  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    scope: 'https://www.googleapis.com/auth/drive'
  });

  google.accounts.id.renderButton(
    document.getElementById('content'),
    { theme: 'outline', size: 'large' }
  );

  //google.accounts.id.prompt(); // Display the One Tap prompt if you wish
}

function handleCredentialResponse(response) {
  console.log("ID token: " + response.credential);
  initClient(); // Pass the ID token to the initClient function
}

function initClient() {
  client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    apiKey: API_KEY,
    scope: 'https://www.googleapis.com/auth/drive',
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        access_token = tokenResponse.access_token;
        listFilesInFolder();
      }
    },
  });

  client.requestAccessToken();
}

// Function to list files in a folder
function listFilesInFolder() {
  gapi.client.drive.files.list({
    'q': `'0B-msUMFQZ0hOaEl1enhwT1NSalk' in parents and trashed=false`,
    'pageSize': 10,
    'fields': 'nextPageToken, files(id, name)',
  }).then(function(response) {
    var files = response.result.files;
    if (files && files.length > 0) {
      console.log('Files:');
      files.forEach(function(file) {
        console.log(file.name+ ' (' + file.id + ')');
      });
    } else {
      console.log('No files found.');
    }
  }).catch(function(error) {
    console.error('Error while listing files', error);
  });
}
