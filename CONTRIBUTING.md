# Contributing to Atuin Desktop

*Note:* This repository contains a `workspace/` folder, which contains an offline Atuin Desktop workspace with runbooks that can be useful for development and testing. Create a new offline workspace and choose the `workspace/` folder as the workspace directory to open it. We will be expanding this workspace with more runbooks and information over time.

## Prerequisites

Developing on Atuin Desktop requires:

* Node.js 20.18.0 (see `.tool-versions` for most up-to-date information)
* [pnpm](https://pnpm.io/installation)
* Latest Rust stable

Since Atuin Desktop is a Tauri app, you'll also need all of the prerequisites listed in the [Tauri Prerequisites doc](https://tauri.app/start/prerequisites/) for your platform.

## Optional tools

For development, you may find it useful to have the following tools installed:

* [direnv](https://direnv.net/)

For documentation, you may find it useful to have the following tools installed:

* [uv](https://docs.astral.sh/uv/#installation)

## Installing dependencies

```
pnpm install
```

## Running development

```
./script/dev
```

`script/dev` accepts the following options:

```
$ ./script/dev --help
Usage: script/dev [OPTIONS]

Options:
  -p --profile VALUE   Start with the given dev profile
  -s --no-sync         Start with automatic sync disabled
  -d --devtools        Start with devtools opened
  -h --help            Display this help message and exit
```

By default, the app will use the profile `dev`. You can pass a different profile name to use a different set of databases.

## Building

### Building a binary (no packaging)

```
pnpm run tauri dev --no-bundle
```

### Building a package

```
pnpm run tauri build
```

### Regenerating TS-RS bindings from Rust structs

```
pnpm generate-bindings
```

## Developer Tools

A global `app` object lives on the `window`. Items can be added to it via `DevConsole.addAppObject()`. The following items are currently available on the object:

* `app.useStore` - the store instance
* `app.state` - a proxy that forwards all property access to `useStore.getState()`
* `app.api` - API functions
* `app.invoke` - Tauri invoke function
* `app.serverObserver` - the server observer instance
* `app.socketManager` - the socket manager instance
* `app.notificationManager` - the notification manager instance
* `app.workspaceSyncManager` - the workspace sync manager instance
* `app.queryClient` - the React-Query client
* `app.AppBus` - the application bus instance
* `app.SSHBus` - the SSH bus instance
* `app.EditorBus` - the editor bus instance
* `app.BlockBus` - the block bus instance
* `app.SharedStateManager` - the shared state manager
* `app.models` - model classes (Runbook, Workspace, Operation)
* `app.handleDeepLink` - function to handle deep links
* `app.setHubCredentials` - function to set hub credentials in development
* `app.editor` - the BlockNote editor instance (when available)

## Common Issues

### Node.js runs out of memory running `pnpm tauri build`

You can increase the memory limit by setting the `NODE_OPTIONS` environment variable to `--max-old-space-size=5120`. For example:

```
NODE_OPTIONS=--max-old-space-size=5120 pnpm tauri build
```

This repository contains an `.envrc` file that sets this for you if you use [direnv](https://direnv.net/).

### I can't create online workspaces or runbooks

Creating online workspaces and runbooks requires the user to be logged in to Atuin Hub. Atuin Hub is not currently open source, but we are exploring options to make it possible to work on this part of the app without it.
