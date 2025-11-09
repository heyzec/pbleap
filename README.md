# vscode-ext
```sh
code --extensionDevelopmentPath=.
```

## Developer Guide
Setup and install
```sh
npm install
just install
```

Install and trigger reload
```sh
just reinstall
```

Start hot-reload of extension
```sh
just dev
```

### Known issues
**punycode is deprecated**
```
DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```
Wait for https://github.com/markdown-it/markdown-it/issues/1065 to be resolved.
