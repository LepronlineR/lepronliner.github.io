document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('cli-input');
    const output = document.getElementById('cli-output');
    
    // Predefined prompt
    const username = 'username';
    const hostname = 'DESKTOP-EBKFG8C';
    const promptText = `<span class="cli-prompt">${username}@${hostname}:~$</span>`;
  
    // Initialize CLI
    function initCLI() {
      // Add initial prompt to output
      output.innerHTML = `${promptText} `;
      input.focus();
    }
  
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const command = input.value.trim();
        if (command) {
          handleCommand(command);
          input.value = '';
          // Keep the input field at the end
          input.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        event.preventDefault(); // Prevent default behavior for Enter key
      }
    });
  
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
      appendOutput(`${promptText} ${command}\n${response}`);
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
      // Example fortunes
      const fortunes = [
        "You will have a great day!",
        "Good things are coming your way.",
        "You will achieve your goals."
      ];
      return fortunes[Math.floor(Math.random() * fortunes.length)];
    }
  
    function getAsciiArt() {
      // Example ASCII Art
      return `
        _    _      _ 
       | |  | |    | |
       | |  | | ___| | ___ ___  _ __ ___   ___ 
       | |/\\| |/ _ \\ |/ __/ _ \\| '_ \` _ \\ / _ \\
       \\  /\\  /  __/ | (_| (_) | | | | | |  __/
        \\/  \\/ \\___|_|\\___\\___/|_| |_| |_|\\___|
      `;
    }
  
    function appendOutput(text) {
      const newOutput = document.createElement('div');
      newOutput.innerHTML = text;
      output.appendChild(newOutput);
      output.scrollTop = output.scrollHeight;
    }
  
    initCLI();
  });
  