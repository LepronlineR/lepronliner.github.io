document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('cli-output');
  const container = document.getElementById('cli-container');

  let username = 'username';
  const hostname = 'DESKTOP';
  let directory;
  let directoryStructure;
  let directorySource;

  const jsonFilePath = '../assets/cli/cli.json';
  const jsonCLIDirFilePath = '../assets/cli/clidir.json';

  // Read and parse the JSON file
  // (attrition to ascii art: asciiart.eu)
  let cliJson;
  let cliDir;
  let cliASCII;
  let cliFortunes;

  async function initCLI() {
    try {
      // fetch and load the JSON data
      const response = await fetch(jsonFilePath);
      if (!response.ok) { throw new Error('json fetch error'); }
      cliJson = await response.json();

      // add the usage first
      const usage = document.createElement('div');
      usage.id = 'cli-usage';
      usage.innerHTML = `<span class="cli-output">${usageMsg}</span>`
      output.appendChild(usage);

      cliASCII = cliJson["ascii-art"].map(item => item.ascii);
      cliFortunes = cliJson["fortunes"].map(item => item.fortune);

      // Fetch and load the CLIDIR json data
      const dirResponse = await fetch(jsonCLIDirFilePath);
      if (!dirResponse.ok) { throw new Error('json dir fetch error'); }
      cliDir = await dirResponse.json();

      // create the directory structure and set it to the source (tilde)
      directoryStructure = parseJSONToDirectoryTree(cliDir);
      assignDirectoryParents(directoryStructure);
      directoryStructure = directoryStructure.findNode("~");
      directorySource = directoryStructure;
      directory = '~';

      appendInput();
    } catch (error) {
      console.error('Error fetching or parsing data:', error);
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
    open        Opens a .page file.
    read        Reads a .text file. (UNDER CONSTRUCTION)
    fortune     Tell me a fortune.
    ascii       Generate some ascii art.
    username    Changes the username.

  <span style="font-weight: bold; text-decoration: underline;">Kernel Commands: </span> (not a part of the cli usage)
    ls          List the directory.
    cd          Change the directory.
    clear       Clears the output.
  
  Please report any bugs to my personal contacts :)
  </pre>`;

  function appendInput() {
    const prompter = `<span class="cli-prompt">${username}@${hostname}</span><span class="cli-default">:</span><span class="cli-directory">${directory}</span><span class="cli-default">$ </span>`;

    const inputContainer = document.createElement('div');
    inputContainer.id = 'cli-input-container';
    inputContainer.innerHTML = prompter;

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
        newOutput.innerHTML = prompter + `<span class="cli-input-command">${command} </span>`;
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
      case 'ls':
        response = handleLSCommand();
        break;
      case 'cd':
        response = handleCDCommand(args);
        break;
      case 'clear':
        response = '';
        output.textContent = '';
        break;
      default:
        response = `${command}: command not found`;
        break;
    }
    
    return `<pre>${response}</pre>`;
  }

  function handleCLICommands(args) {
    const failCase = 'Command or flag is wrong or does not exist. \nFor help, use the \'z help\' or for more specific command help use \'z help [command]\'';
    const commandHandler = new Map([
      ['help', (args) => {
        if(args.length == 3){
          const helpCommands = {
            'help' : 'Help does not need help!',
            'open' : 'Usage: z open [file-name] \nDescription: \n \t Opens a valid page for a file as long as the link for the file-name is correct. \nOptions: \n \t N/A',
            'fortune' : 'Usage: z fortune \nDescription: \n \t Outputs a random fortune for you. \nOptions: \n \t N/A',
            'ascii' : 'Usage: z ascii \nDescription: \n \t Outputs a random ascii image. \nOptions: \n \t N/A',
            'username' : 'Usage: z username [input] \nDescription: \n \t Changes the terminal username as the [input], usernames with \n \t 20 or less characters are accepted. \nOptions: \n \t N/A',
          };
          return helpCommands[args[2]] || failCase;
        } else if(args.length == 2){
          return usageMsg;
        }
      }],
      ['open', (args) => args.length == 3 ? handleFileOpen(args[2]) : failCase],      
      ['fortune', (args) => args.length == 2 ? cliFortunes[Math.floor(Math.random() * cliFortunes.length)] : failCase],
      ['ascii', (args) => args.length == 2 ? cliASCII[Math.floor(Math.random() * cliASCII.length)] : failCase ],
      ['username', (args) => {
          if(args.length == 3){
            if(args[2].length > 20){
              return 'Please keep the username to 20 or less characters.';
            } else {
              return handleUserNameChange(args[2]);
            }
          } else { return failCase }
        }]
    ]);

    var getHandlerResult = commandHandler.get(args[1]);

    return getHandlerResult ? getHandlerResult(args) : failCase;
  }

  /* HANDLING SPECIFIC CLI COMMANDS */
  function handleUserNameChange(name) { username = name; return `Successfully changed username to: ${name}`}

  function handleFileOpen(filename) {
    const file = directoryStructure.findNode(filename);
    if(file != null){
      window.open(file.getValue(), '_self');
      return '';
    } else {
      return 'Error: file does not exist or user inputted incorrect file.'
    }
  }

  /* DIRECTORY SYSTEM */
  
  class DirectoryNode {
    constructor(key, value, children = []){
      this.key = key;
      this.value = value;
      this.children = children;
    }

    setParent(parent) { this.parent = parent; }
    getKey(){ return this.key; }
    getValue(){ return this.value; }
    getParent(){ return this.parent; }
    getAllChildren(){ return this.children; }

    findNode(key){ return this.children.find(node => node.getKey() == key); }
  }

  function parseJSONToDirectoryTree(dir){
    function createNode(k, v) {
      if(Array.isArray(v)) {
        const children = v.map(item => {
          const [child] = Object.keys(item);
          return createNode(child, item[child]);
        });
        return new DirectoryNode(k, null, children);
      } else {
        return new DirectoryNode(k, v, []);
      }
    }

    const k = Object.keys(dir)[0];
    const v = dir[k];
    return createNode(k, v);
  }

  function assignDirectoryParents(node, parent = null) {
    node.setParent(parent);
    node.children.forEach(child => assignDirectoryParents(child, node));
  }

  function formatLSOutputValue(node){
    if(node.getValue() == null){
      if(node.getKey() == "~")
        return `<span style="color: #00ffff;">${username}</span>`;
      else
        return `<span style="color: #00ffff;">${node.getKey()}</span>`;
    } else {
      if(node.getKey().endsWith('.page'))
        return `<span style="color: #e1f00f;">${node.getKey()}</span>`;
      else
      return `<span style="color: #ff00d7;">${node.getKey()}</span>`;
    }
  }

  function handleLSCommand(numColumns = 4){
    const currentDir = directoryStructure.getAllChildren();
    var output = '';
    for (let i = 0; i < currentDir.length; i++) {
      output += formatLSOutputValue(currentDir[i]);

      if ((i + 1) % numColumns == 0) {
          output += '\n';
      } else {
          output += '\t\t';
      }
    }
    return output;
  }

  function removeLastDirectory(path) {
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex === -1) { return path; }
    return path.substring(0, lastSlashIndex);
  }

  function handleCDCommand(args){
    const errorText = 'cd command is incorrect';
    if(args.length > 2) {
      return errorText;
    } else if(args.length == 1) {
      directoryStructure = directorySource;
      directory = '~';
      return '';
    }

    if(args[1] === '..') { // go back
      if(directoryStructure.getParent() != null){
        directoryStructure = directoryStructure.getParent();
        
        if(directoryStructure.getKey() == '/'){
          directory = '/';
        } else {
          directory = removeLastDirectory(directory);
        }
      }
      return '';
    }

    const toDirName = directoryStructure.findNode(args[1]);
    const homeNode = directoryStructure.findNode('~');

    // edge case if the username is there
    if(homeNode?.getKey() === '~' && args[1] === username){
      directoryStructure = directorySource;
      directory = '~';
    } else if(toDirName != null){
      directoryStructure = toDirName;
      directory += (`/${toDirName.getKey()}`);
    }

    return '';
  }

  initCLI();
});
