# My PC (browser desktop)

A desktop in the browser: icons, draggable windows, folders, a taskbar and a Start menu. No build step and no dependencies.

## Layout

```
index.html                  the desktop
os/                         desktop code (os.js, os.css) and the virtual file system (fs.js)
apps/command_execute/       Command_Execute, a terminal mini-app
games/points/               Typical Incremental Game (TIG): core.js is the logic, game.js the interface
```

- Click a desktop icon or folder once to open it.
- **Games** opens a folder window listing every game. Click **Typical Incremental Game** to play it.
- **Apps → Command_Execute** is a terminal: try `help`, `ls`, `cd Games`, `open tig`, `calc 2^10`, `theme amber`.

## Publish on GitHub Pages

1. Upload everything in this folder to a repository, keeping the folders.
2. **Settings → Pages → Deploy from a branch → main / (root)**.
3. Visit `https://<your-username>.github.io/<repo-name>/`.

For a link like `https://<your-username>.github.io/`, name the repository `<your-username>.github.io`.

## Add a game or app

1. Put its files in a new folder, for example `games/my-game/` with an `index.html` inside.
2. Add one line in `os/fs.js` under `Games` (or `Apps`):
   `'My Game': app('My Game', '🎲', 'games/my-game/index.html', 800, 600),`

It then appears in the Games folder window and in the terminal automatically.
