setupDropbox() {
  this.db = new Dropbox.Client({
    key: "DYYDuQIY88A=|hZcFHupIV1V83K7o3M0VHrVmeZK70RZnb0PCIVz7ag==",
    sandbox: true
  });
  this.db.authDriver(new Dropbox.Drivers.Redirect({
    rememberUser: true
  }));
  // as redirect param
  return this.db.authenticate((error, client) => {
    if (error) {
      return showError(error);
    }
    return this.db.getUserInfo((error, userInfo) => {
      if (error) {
        return showError(error);
      }
      $('#userName').html(userInfo.name);
      $('#loading').html('Loading Scores from DropBox. Please wait..');
      return this.db.readFile("scores-db.txt", (error, rawData) => {
        if (error) {
          return showError(error);
        }
        // load data from dropbox text file
        this.all = rawData.split('\n').filter(function(l) {
          return l.length > 10;
        }).map(function(l) {
          var summary;
          summary = parseInt(l[11]);
          if (summary == null) {
            summary = null;
          }
          return new Score(Date.create(l.slice(0, 10)), summary, l.slice(13));
        });
        return this.onScoreLoaded();
      });
    });
  });
}