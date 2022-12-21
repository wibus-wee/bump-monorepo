# bump-monorepo

A Command Line Tool to bump monorepo packages.

![preview](https://user-images.githubusercontent.com/62133302/208828975-641b0105-9c62-4284-ace9-df0f61a6b5d0.gif)

## Features

- [x] Bump packages in monorepo
- [x] Commit and push
- [x] Pre-commit hook
- [x] After-push hook
- [x] Alpha, Beta, Canary, RC, Patch, Minor, Major, Custom version
- [x] Custom commit message

> This project is quite restrictive because it was developed for proprietary repositories. If you have any suggestions, please feel free to open an issue.

## Usage

```bash
$ npm i -g @wibus-wee/bump-monorepo
```

Write your config in `package.json`:

```json5
{
  // ...
  bump: {
		message: "release: %s", // commit message
		preCommit: [], // pre-commit hook
		afterPush: [], // after-push hook
	}
  // ...
}
```

## Author

bump-monorepo © Wibus, Released under MIT. Created on Dec 21, 2022

> [Personal Website](http://iucky.cn/) · [Blog](https://blog.iucky.cn/) · GitHub [@wibus-wee](https://github.com/wibus-wee/) · Telegram [@wibus✪](https://t.me/wibus_wee)
