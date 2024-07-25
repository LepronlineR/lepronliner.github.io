document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('cli-output');
  const container = document.getElementById('cli-container');

  let username = 'username';
  const hostname = 'DESKTOP';
  let directory = '~';

  const jsonFilePath = '../assets/cli/cli.json';

  // Read and parse the JSON file
  let cliJson;
  let cliASCII;
  let cliFortunes;

  // Function to fetch and load the JSON data
  async function initCLI() {
    try {
      // Fetch the JSON data
      const response = await fetch(jsonFilePath);
      
      // Check if the response is successful
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Parse the JSON data and store it in the global variable
      cliJson = await response.json();

      // add the usage first
      const usage = document.createElement('div');
      usage.id = 'cli-usage';
      usage.innerHTML = `<span class="cli-output">${usageMsg}</span>`
      output.appendChild(usage);

      cliASCII = cliJson["ascii-art"].map(item => item.ascii);
      cliFortunes = cliJson["fortunes"].map(item => item.fortune);

      appendInput();
    } catch (error) {
      console.error('Error fetching or parsing the JSON data:', error);
    }
  }
  

  const usageMsg = 
  `<pre>
   /<span style="color: #00ffff;">$$$$$$$$</span>             /<span style="color: #00ffff;">$$$$$$</span>   /<span style="color: #00ffff;">$$</span>       /<span style="color: #00ffff;">$$$$$$</span>      
  |_____ <span style="color: #00ffff;">$$</span>             /<span style="color: #00ffff;">$$</span>__  <span style="color: #00ffff;">$$</span> | <span style="color: #00ffff;">$$</span>      |_  <span style="color: #00ffff;">$$</span>_/   <span style="font-weight: bold; text-decoration: underline;">Z-CLI</span> 
       /<span style="color: #00ffff;">$$</span>/            | <span style="color: #00ffff;">$$</span>  \\__/ | <span style="color: #00ffff;">$$</span>        | <span style="color: #00ffff;">$$</span>     
      /<span style="color: #00ffff;">$$</span>/    /<span style="color: #c300ff;">$$$$$$</span>  | <span style="color: #00ffff;">$$</span>       | <span style="color: #00ffff;">$$</span>        | <span style="color: #00ffff;">$$</span>     A custom CLI developed for the
     /<span style="color: #00ffff;">$$</span>/    |______/  | <span style="color: #00ffff;">$$</span>       | <span style="color: #00ffff;">$$</span>        | <span style="color: #00ffff;">$$</span>      purposes of this demonstration
    /<span style="color: #00ffff;">$$</span>/               | <span style="color: #00ffff;">$$</span>    <span style="color: #00ffff;">$$</span> | <span style="color: #00ffff;">$$</span>        | <span style="color: #00ffff;">$$</span>     
   /<span style="color: #00ffff;">$$$$$$$$</span>           |  <span style="color: #00ffff;">$$$$$$</span>/ | <span style="color: #00ffff;">$$$$$$$$</span> /<span style="color: #00ffff;">$$$$$$</span>   Usage: z &lt;command&gt; [options]
  |________/            \______/   |________/ |______/     Example Usage: z help ascii

  <span style="font-weight: bold; text-decoration: underline;">Commands:</span>
    help        Displays this help message or help for a specific command as an option.
    fortune     Tell me a fortune.
    ascii       Generate some ascii art.
  </pre>`;

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

    // focus input when container is clicked
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

    switch (cmd) {
      case 'z':
        response = handleCLICommands(args);
        break;
      default:
        response = `${command}: command not found`;
        break;
    }
    
    return response;
  }

  function handleCLICommands(args) {
    const failCase = 'Command or flag is wrong or does not exist. For help, use the \'z help\' or for more specific command help use \'z help [command]\'';
    
    switch (args[1]) {
      case 'help':
        // handle help cases for different commands
        if(args.length == 3) {
          switch(args[2]){
            case 'help':
              return 'Help does not need help!';
            case 'fortune':
              return ''
            default:
              return failCase;
          }
        } else if(args.length == 2) {
          return usageMsg;
        } else {
          return failCase;
        }
      case 'fortune':
        return getFortune();
      case 'ascii':
        return getAsciiArt();
      default:
        return failCase;
    }
  }

  function getFortune() {
    return cliFortunes[Math.floor(Math.random() * cliFortunes.length)];
  }

  function getAsciiArt() {
    return `<pre>${cliASCII[Math.floor(Math.random() * cliASCII.length)]}</pre>`;
  }

  initCLI();
});
