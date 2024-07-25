document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('cli-output');
  const container = document.getElementById('cli-container');

  let username = 'username';
  const hostname = 'DESKTOP';
  let directory = `~`;

  function initCLI() {
    appendInput();
  }

  function appendInput() {
    const inputContainer = document.createElement('div');
    inputContainer.id = 'cli-input-container';
    inputContainer.innerHTML = `<span class="cli-prompt">${username}@${hostname}</span><span class="cli-default">:</span><span class="cli-directory">${directory}</span><span class="cli-default">$ </span>`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'cli-input';

    inputContainer.appendChild(input);
    output.appendChild(inputContainer);
    input.focus();

    // Add event listener to focus input when container is clicked
    container.addEventListener('click', () => {
      input.focus();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const command = input.value.trim();
        let response = '';
        // handle an input command for the CLI
        if (command) {
          response = handleCommand(command);
        }

        // create the entered prompt + command
        const newOutput = document.createElement('div');
        newOutput.innerHTML = `<span class="cli-prompt">${username}@${hostname}</span><span class="cli-default">:</span><span class="cli-directory">${directory}</span><span class="cli-default">$ </span><span class="cli-input-command">${command} </span>`;
        output.appendChild(newOutput);

        if (response) {
          const responseOutput = document.createElement('div');
          responseOutput.innerHTML = response;
          output.appendChild(responseOutput);
        }

        inputContainer.remove();
        appendInput();
        event.preventDefault();
      }
    });
    output.scrollTop = output.scrollHeight;
  }

  function handleCommand(command) {
    let response;
    const args = command.split(' ');
    const cmd = args[0];
    const flag = args.length > 1 ? args[1] : null;

    switch (cmd) {
      case 'z':
        response = handleZCommand(flag);
        break;
      case 'help':
        response = 'Available commands: z -help, z -fortune, z -ascii';
        break;
      default:
        response = `Unknown command: ${command}`;
        break;
    }
    
    return response;
  }

  function handleZCommand(flag) {
    switch (flag) {
      case '-help':
        return 'Commands: -help, -fortune, -ascii';
      case '-fortune':
        return getFortune();
      case '-ascii':
        return getAsciiArt();
      default:
        return 'Invalid flag. Use -help for available commands.';
    }
  }

  function getFortune() {
    const fortunes = [
      "You will have a great day!",
      "Good things are coming your way.",
      "You will achieve your goals."
    ];
    return fortunes[Math.floor(Math.random() * fortunes.length)];
  }

  function getAsciiArt() {
    return `
      _    _      _ 
     | |  | |    | |
     | |  | | ___| | ___ ___  _ __ ___   ___ 
     | |/\\| |/ _ \\ |/ __/ _ \\| '_ \` _ \\ / _ \\
     \\  /\\  /  __/ | (_| (_) | | | | | |  __/
      \\/  \\/ \\___|_|\\___\\___/|_| |_| |_|\\___|
    `;
  }

  initCLI();
});
