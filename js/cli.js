document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('cli-output');
    const container = document.getElementById('cli-container');
    
    const kernel_commands = ["ls", "cd", "clear"];
    const z_commands = ["help", "open", "read", "fortune", "ascii", "username"];

    // Read and parse the JSON file
    // (attrition to ascii art: asciiart.eu)
    let cliJson;
    let cliASCII;
    let cliFortunes;
    const jsonFilePath = '../assets/cli/cli.json';
    const jsonCLIDirFilePath = '../assets/cli/clidir.json';

    let username = 'username';
    const hostname = 'DESKTOP';

    // Directory system
    let cliDir;
    let directory;
    let directoryStructure;
    let directorySource;

    // Saves all the user inputs
    let savedInputs = [];
    let savedInputsTracker = 0;

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
        read        Reads a .text file.
        fortune     Tell me a fortune.
        ascii       Generate some ascii art.
        username    Changes the username.
  
    <span style="font-weight: bold; text-decoration: underline;">Kernel Commands: </span> (not a part of the cli usage)
        ls          List the directory.
        cd          Change the directory.
        clear       Clears the output.
        echo        Echo.

    Here are some example commands you can enter: [z help] [cd portfolio]
    </pre>`;

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

    function appendInput(priorInput = ""){
        const prompter = `<span class="cli-prompt">${username}@${hostname}</span><span class="cli-default">:</span><span class="cli-directory">${directory}</span><span class="cli-default">$ </span>`;

        const inputContainer = document.createElement('div');
        inputContainer.id = 'cli-input-container';
        inputContainer.innerHTML = prompter;

        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.id = 'cli-input';
        input.value = priorInput;

        inputContainer.appendChild(input);
        output.appendChild(inputContainer);
        input.focus();

        // focus input when container is clicked
        container.addEventListener('click', () => {
            input.focus();
        });

        input.addEventListener('keydown', (event) => {
            
            switch(event.key) {
                case "Enter":
                    const input_text = input.value.trim();
                    let response = '';
                    
                    // handle an input command for the CLI
                    if (input_text) {
                        response = parseInput(input_text);
                    }
            
                    // create the entered prompt + command
                    const newOutput = document.createElement('div');
                    newOutput.innerHTML = prompter + `<span class="cli-input-command">${input_text} </span>`;
                    output.appendChild(newOutput);
                    
                    // add a new input to save all inputs
                    savedInputs.push(input_text);
                    savedInputsTracker = savedInputs.length;
            
                    if (response) {
                        const responseOutput = document.createElement('div');
                        responseOutput.innerHTML = response;
                        output.appendChild(responseOutput);
                    }
            
                    inputContainer.remove();
                    appendInput();
                    event.preventDefault();
                    break;
                case "ArrowUp":
                    if(savedInputsTracker > 0){
                        input.value = savedInputs[--savedInputsTracker];
                    }
                    break;
                case "ArrowDown":
                    if(savedInputsTracker < savedInputs.length - 1){
                        input.value = savedInputs[++savedInputsTracker];
                    }
                    break;
                case "Tab":
                    break;
                default:
                    break;
            }

        });
        output.scrollTop = output.scrollHeight;
    }

    //
    // PARSE INPUTS
    //

    function parseInput(command) {
        let response;
        const args = command.split(' ');
        const cmd = args[0];
    
        switch (cmd) {
            case 'z':
                response = handleCLICommands(args);
                break;
            case 'ls':
                response = handleLSCommand(args);
                break;
            case 'cd':
                response = handleCDCommand(args);
                break;
            case 'echo':
                response = command.substring(5);
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

    //
    // HANDLING SPECIFIC Z-COMMANDS
    //

    function handleCLICommands(args) {
        const failCase = 'Command or flag is wrong or does not exist. \nFor help, use the \'z help\' or for more specific command help use \'z help [command]\'';
        const commandHandler = new Map([
            ['help', (args) => {
                if(args.length == 3){
                    const helpCommands = {
                        'help' : 'Help does not need help!',
                        'open' : 'Usage: z open [file-name] \nDescription: \n \t Opens a valid page for a file as long as the link for the file-name is correct. \nOptions: \n \t N/A',
                        'read' : 'Usage: z read [textfile-name] \nDescription: \n \t Reads a valid page for a file as long as the link for the file-name is correct. \nOptions: \n \t N/A',            
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
            ['read', (args) => args.length == 3 ? handleFileRead(args[2]) : failCase],     
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

    function handleUserNameChange(name) { username = name; return `Successfully changed username to: ${name}`}

    function handleFileRead(filename){
        if(!filename.endsWith(".text"))
            return 'Error: cannot read files without the .text extension.';

        const file = directoryStructure.findNode(filename);
        if(file != null){
            return file.getValue();
        } else {
            return 'Error: file does not exist or user inputted incorrect file.'
        }
    }

    function handleFileOpen(filename) {
        if(!filename.endsWith(".page"))
            return 'Error: cannot open files without the .page extension.';
    
        const file = directoryStructure.findNode(filename);
        
        if(file != null){
            window.open(file.getValue(), '_self');
            return '';
        } else {
            return 'Error: file does not exist or user inputted incorrect file.'
        }
    }


    //
    // DIRECTORY SYSTEM
    //

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
        
        // given a list of directories return if this list is true, otherwise null
        //  i.e. path/to/directory 
        findDirectory(directories) { 
            var paths = directories.split('/');
            if(paths[0] == '.') // remove starting dir
                paths.shift();
            
            console.log(paths);

            var target = this;
            for(const path of paths){
                if(path)
                    target = target.findNode(path);
            }
            return target;
        }
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

    function handleLSCommand(args, numColumns = 4){

        var currentDir;
        if(args.length > 1) { 
            let res = directoryStructure.findDirectory(args[1]);
            if(res == undefined) return `ls: cannot access '${args[1]}': No such file or directory`;
            currentDir = res.getAllChildren();
        } else {
            currentDir = directoryStructure.getAllChildren();
        }
        
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

        // separate the directory to a list of nodes instead of manually checking (use the same system for LS)
        // TODO 

        //if (args[1].startsWith('./')) { // case that inputs start with ./ for the directory location
        //    args[1] = args[1].substring(2);
        //}

        const toDirName = directoryStructure.findDirectory(args[1]);
        if(toDirName == undefined) 
            return `cd: '${args[1]}': No such file or directory`;

        const homeNode = directoryStructure.findNode('~');
    
        // edge case if the username is there
        if(homeNode?.getKey() === '~' && args[1] === username){
            directoryStructure = directorySource;
            directory = '~';
        } else if(toDirName != null){
            directoryStructure = toDirName;
            directory += (`/${args[1]}`);
        }
    
        return '';
    }

    initCLI();
});