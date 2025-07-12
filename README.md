# faveday
minimalist journal with stats

# features
* every entry is associated with a 1-5 rating
* your data remains on your machine (if you want to put your data on a cloud synch drive like dropbox that of course your choice)

# development

## building the app
To create distributable packages for multiple platforms:
```bash
npm run make
```

This will generate installers/packages in the `out` directory:
- Windows: Squirrel installer
- macOS: ZIP archive  
- Linux: DEB and RPM packages

## running in development
```bash
npm start
```

icons
- https://iconduck.com/icons/117778/calendar-appointment-date
- https://www.flaticon.com/free-icons/diary
