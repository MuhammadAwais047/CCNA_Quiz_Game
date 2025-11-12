import CCNAState from '../../core/state.js';
import { sanitizeCommand, highlightSyntax } from './syntax-highlighter.js';

export class CLISimulator {
  constructor() {
    this.terminalHistory = [];
    this.currentCommand = '';
    this.commandHistory = [];
    this.historyIndex = -1;
    this.isPrivilegedMode = false;
    this.currentContext = 'user'; // user, privileged, config
    this.routerConfig = {
      hostname: 'Router',
      interfaces: {},
      routing: {},
      security: {}
    };
    
    this.commandHandlers = {
      'enable': this.handleEnable.bind(this),
      'disable': this.handleDisable.bind(this),
      'configure terminal': this.handleConfigTerminal.bind(this),
      'exit': this.handleExit.bind(this),
      'end': this.handleEnd.bind(this),
      'show': this.handleShow.bind(this),
      'interface': this.handleInterface.bind(this),
      'ip address': this.handleIpAddress.bind(this),
      'no shutdown': this.handleNoShutdown.bind(this),
      'description': this.handleDescription.bind(this),
      'router ospf': this.handleRouterOspf.bind(this),
      'network': this.handleNetwork.bind(this),
      'area': this.handleArea.bind(this),
      'default-router': this.handleDefaultRouter.bind(this),
      'dns-server': this.handleDnsServer.bind(this),
      'line vty': this.handleLineVty.bind(this),
      'transport input': this.handleTransportInput.bind(this),
      'login local': this.handleLoginLocal.bind(this),
      'username': this.handleUsername.bind(this),
      'ip route': this.handleIpRoute.bind(this),
      'access-list': this.handleAccessList.bind(this),
      'ping': this.handlePing.bind(this),
      'traceroute': this.handleTraceroute.bind(this),
      'copy running-config startup-config': this.handleCopyConfig.bind(this),
      'reload': this.handleReload.bind(this),
      'debug': this.handleDebug.bind(this),
      'undebug all': this.handleUndebugAll.bind(this),
      'terminal monitor': this.handleTerminalMonitor.bind(this),
      'help': this.handleHelp.bind(this),
      '?': this.handleHelp.bind(this)
    };
  }

  initialize(labData) {
    this.currentLab = labData;
    this.resetTerminal();
    this.appendToTerminal(`Welcome to CCNA CLI Simulator v3.1`);
    this.appendToTerminal(`Lab: ${labData.name}`);
    this.appendToTerminal(`Scenario: ${labData.scenario}`);
    this.appendToTerminal('');
    this.prompt();
  }

  resetTerminal() {
    this.terminalHistory = [];
    this.commandHistory = [];
    this.historyIndex = -1;
    this.isPrivilegedMode = false;
    this.currentContext = 'user';
    this.routerConfig = {
      hostname: 'Router',
      interfaces: {
        'GigabitEthernet0/0': { ip: '192.168.1.1', mask: '255.255.255.0', status: 'up' },
        'GigabitEthernet0/1': { status: 'down' }
      },
      routing: {},
      security: {}
    };
    
    // Apply lab-specific initial configuration
    if (this.currentLab?.initialConfig) {
      Object.assign(this.routerConfig, this.currentLab.initialConfig);
    }
  }

  appendToTerminal(text, type = 'output') {
    this.terminalHistory.push({ text, type, timestamp: Date.now() });
    document.dispatchEvent(new CustomEvent('cli:terminal-update', { 
      detail: { text, type } 
    }));
  }

  prompt() {
    const promptText = this.getPrompt();
    this.appendToTerminal(promptText, 'prompt');
  }

  getPrompt() {
    let prompt = this.routerConfig.hostname || 'Router';
    
    switch(this.currentContext) {
      case 'privileged':
        prompt += '#';
        break;
      case 'config':
        prompt += '(config)#';
        break;
      case 'config-if':
        prompt += '(config-if)#';
        break;
      case 'config-router':
        prompt += '(config-router)#';
        break;
      default:
        prompt += '>';
    }
    
    return prompt;
  }

  executeCommand(command) {
    if (!command.trim()) {
      this.prompt();
      return;
    }
    
    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    // Log command
    this.appendToTerminal(command, 'command');
    
    // Parse and execute
    const sanitizedCommand = sanitizeCommand(command);
    const [mainCommand, ...args] = sanitizedCommand.split(' ');
    
    try {
      // Find matching handler
      let handlerFound = false;
      
      // Check for full command handlers first (for commands with spaces)
      const fullCommand = sanitizedCommand;
      if (this.commandHandlers[fullCommand]) {
        this.commandHandlers[fullCommand](args.join(' '));
        handlerFound = true;
      } 
      // Check for main command handlers
      else if (this.commandHandlers[mainCommand]) {
        this.commandHandlers[mainCommand](args.join(' '));
        handlerFound = true;
      }
      
      if (!handlerFound) {
        this.appendToTerminal(`% Invalid input detected at '^' marker.`);
        this.appendToTerminal(`% Unknown command or computer name, not found or incomplete.`);
      }
    } catch (error) {
      console.error('[CLI] Command execution error:', error);
      this.appendToTerminal(`% Command execution failed: ${error.message}`);
    }
    
    // Check for lab completion
    this.checkLabCompletion();
    
    // Show prompt again
    this.prompt();
  }

  // Command handlers
  handleEnable() {
    this.isPrivilegedMode = true;
    this.currentContext = 'privileged';
    // In real IOS, enable might require a password
    this.appendToTerminal('');
  }

  handleDisable() {
    this.isPrivilegedMode = false;
    this.currentContext = 'user';
    this.appendToTerminal('');
  }

  handleConfigTerminal() {
    if (!this.isPrivilegedMode) {
      this.appendToTerminal(`% Invalid input detected at '^' marker.`);
      this.appendToTerminal(`% Only privileged mode can enter configuration mode`);
      return;
    }
    this.currentContext = 'config';
    this.appendToTerminal('');
  }

  handleExit() {
    switch(this.currentContext) {
      case 'config-if':
        this.currentContext = 'config';
        break;
      case 'config-router':
        this.currentContext = 'config';
        break;
      case 'config':
        this.currentContext = 'privileged';
        break;
      case 'privileged':
        this.currentContext = 'user';
        this.isPrivilegedMode = false;
        break;
    }
    this.appendToTerminal('');
  }

  handleEnd() {
    if (this.currentContext.startsWith('config')) {
      this.currentContext = 'privileged';
      this.appendToTerminal('');
    } else {
      this.appendToTerminal(`% Invalid input detected at '^' marker.`);
    }
  }

  handleShow(args) {
    const [subCommand, ...params] = args.split(' ');
    
    switch(subCommand) {
      case 'version':
        this.appendToTerminal('Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M');
        this.appendToTerminal('Technical Support: http://www.cisco.com/techsupport');
        this.appendToTerminal('Copyright (c) 1986-2020 by Cisco Systems, Inc.');
        this.appendToTerminal('Compiled Thu 22-Oct-20 13:19 by prod_rel_team');
        break;
        
      case 'running-config':
      case 'run':
        this.appendToTerminal('Building configuration...');
        this.appendToTerminal('');
        this.appendToTerminal('Current configuration : 1541 bytes');
        this.appendToTerminal('!');
        this.appendToTerminal(`hostname ${this.routerConfig.hostname}`);
        this.appendToTerminal('!');
        this.appendToTerminal('interface GigabitEthernet0/0');
        this.appendToTerminal(` ip address ${this.routerConfig.interfaces['GigabitEthernet0/0'].ip} ${this.routerConfig.interfaces['GigabitEthernet0/0'].mask}`);
        this.appendToTerminal(' duplex auto');
        this.appendToTerminal(' speed auto');
        this.appendToTerminal('!');
        this.appendToTerminal('interface GigabitEthernet0/1');
        this.appendToTerminal(' no ip address');
        this.appendToTerminal(' shutdown');
        this.appendToTerminal(' duplex auto');
        this.appendToTerminal(' speed auto');
        this.appendToTerminal('!');
        this.appendToTerminal('router ospf 1');
        this.appendToTerminal('!');
        this.appendToTerminal('line con 0');
        this.appendToTerminal('line vty 0 4');
        this.appendToTerminal(' login');
        this.appendToTerminal('!');
        this.appendToTerminal('end');
        break;
        
      case 'ip':
        const [ipSubCommand, ...ipParams] = params;
        if (ipSubCommand === 'interface' && ipParams[0] === 'brief') {
          this.appendToTerminal('Interface                  IP-Address      OK? Method Status                Protocol');
          this.appendToTerminal('GigabitEthernet0/0         192.168.1.1     YES manual up                    up');
          this.appendToTerminal('GigabitEthernet0/1         unassigned      YES unset  administratively down down');
          this.appendToTerminal('Loopback0                  10.0.0.1        YES manual up                    up');
        } else {
          this.appendToTerminal(`% Invalid subcommand: ${ipSubCommand}`);
        }
        break;
        
      case 'interfaces':
        this.appendToTerminal('GigabitEthernet0/0 is up, line protocol is up');
        this.appendToTerminal('  Hardware is CN Gigabit Ethernet, address is 0011.2233.4455 (bia 0011.2233.4455)');
        this.appendToTerminal('  Internet address is 192.168.1.1/24');
        this.appendToTerminal('  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,');
        this.appendToTerminal('     reliability 255/255, txload 1/255, rxload 1/255');
        this.appendToTerminal('  Encapsulation ARPA, loopback not set');
        this.appendToTerminal('  Keepalive set (10 sec)');
        this.appendToTerminal('  Full Duplex, 1000Mbps, media type is RJ45');
        this.appendToTerminal('  output flow-control is unsupported, input flow-control is unsupported');
        this.appendToTerminal('  ARP type: ARPA, ARP Timeout 04:00:00');
        this.appendToTerminal('  Last input 00:00:12, output 00:00:01, output hang never');
        this.appendToTerminal('  Last clearing of "show interface" counters never');
        this.appendToTerminal('  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0');
        this.appendToTerminal('  Queueing strategy: fifo');
        this.appendToTerminal('  Output queue: 0/40 (size/max)');
        this.appendToTerminal('  5 minute input rate 0 bits/sec, 0 packets/sec');
        this.appendToTerminal('  5 minute output rate 0 bits/sec, 0 packets/sec');
        this.appendToTerminal('     123456 packets input, 12345678 bytes, 0 no buffer');
        this.appendToTerminal('     Received 0 broadcasts (0 IP multicasts)');
        this.appendToTerminal('     0 runts, 0 giants, 0 throttles');
        this.appendToTerminal('     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored');
        this.appendToTerminal('     0 watchdog, 0 multicast, 0 pause input');
        this.appendToTerminal('     0 input packets with dribble condition detected');
        this.appendToTerminal('     123456 packets output, 12345678 bytes, 0 underruns');
        this.appendToTerminal('     0 output errors, 0 collisions, 0 interface resets');
        this.appendToTerminal('     0 unknown protocol drops');
        this.appendToTerminal('     0 babbles, 0 late collision, 0 deferred');
        this.appendToTerminal('     0 lost carrier, 0 no carrier, 0 pause output');
        this.appendToTerminal('     0 output buffer failures, 0 output buffers swapped out');
        break;
        
      default:
        this.appendToTerminal(`% Invalid subcommand: ${subCommand}`);
    }
  }

  handlePing(args) {
    if (!args) {
      this.appendToTerminal('Type escape sequence to abort.');
      this.appendToTerminal('Sending 5, 100-byte ICMP Echos to 192.168.1.1, timeout is 2 seconds:');
      this.appendToTerminal('!!!!!');
      this.appendToTerminal('Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms');
      return;
    }
    
    const target = args.trim();
    this.appendToTerminal(`Type escape sequence to abort.`);
    this.appendToTerminal(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
    
    // Simulate success for local network, failure for others
    if (target.startsWith('192.168.1.') || target === '10.0.0.1') {
      this.appendToTerminal('!!!!!');
      this.appendToTerminal(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms`);
    } else if (target.startsWith('8.8.8.')) {
      this.appendToTerminal('.!!!!');
      this.appendToTerminal(`Success rate is 80 percent (4/5), round-trip min/avg/max = 20/25/30 ms`);
    } else {
      this.appendToTerminal('.....');
      this.appendToTerminal(`Success rate is 0 percent (0/5)`);
    }
  }

  handleHelp() {
    this.appendToTerminal('CLI Simulator Help:');
    this.appendToTerminal('');
    this.appendToTerminal('Basic Commands:');
    this.appendToTerminal('  enable/disable             - Enter/exit privileged mode');
    this.appendToTerminal('  configure terminal         - Enter configuration mode');
    this.appendToTerminal('  exit/end                   - Exit current mode');
    this.appendToTerminal('  show version               - Display system information');
    this.appendToTerminal('  show running-config        - Display current configuration');
    this.appendToTerminal('  show ip interface brief    - Display interface status');
    this.appendToTerminal('  ping [target]             - Test connectivity');
    this.appendToTerminal('');
    this.appendToTerminal('Configuration Commands:');
    this.appendToTerminal('  hostname [name]           - Set device hostname');
    this.appendToTerminal('  interface [name]          - Enter interface configuration');
    this.appendToTerminal('  ip address [ip] [mask]    - Set interface IP address');
    this.appendToTerminal('  no shutdown               - Enable interface');
    this.appendToTerminal('  router ospf [id]          - Configure OSPF routing');
    this.appendToTerminal('');
    this.appendToTerminal('Lab Commands:');
    this.appendToTerminal('  show lab objectives       - Display lab goals');
    this.appendToTerminal('  show lab solution         - Display solution commands');
    this.appendToTerminal('  check lab                 - Verify lab completion');
    this.appendToTerminal('');
    this.appendToTerminal('Type \'?\' at any prompt for context-sensitive help');
  }

  checkLabCompletion() {
    if (!this.currentLab?.solution) return;
    
    // Check if all required commands have been executed
    const executedCommands = this.commandHistory.map(cmd => cmd.toLowerCase());
    const requiredCommands = this.currentLab.solution.map(cmd => cmd.toLowerCase());
    
    const missingCommands = requiredCommands.filter(cmd => 
      !executedCommands.some(executed => executed.includes(cmd.split(' ')[0]))
    );
    
    if (missingCommands.length === 0) {
      // Lab completed
      this.appendToTerminal('');
      this.appendToTerminal('************************************************************************');
      this.appendToTerminal('**                                                                    **');
      this.appendToTerminal('**                          🎉 LAB COMPLETED!                         **');
      this.appendToTerminal('**                                                                    **');
      this.appendToTerminal('**  You\'ve successfully configured the device according to the lab    **');
      this.appendToTerminal('**  requirements. Great job!                                          **');
      this.appendToTerminal('**                                                                    **');
      this.appendToTerminal('************************************************************************');
      this.appendToTerminal('');
      
      // Award points
      const points = this.currentLab.points || 50;
      CCNAState.setState({ 
        session: { 
          ...CCNAState.state.session, 
          score: CCNAState.state.session.score + points 
        } 
      });
      
      this.appendToTerminal(`+${points} points added to your score!`);
      
      // Track completion
      CCNAState.trackProgress('labs', this.currentLab.id, 'completed');
      
      // Play success sound
      document.dispatchEvent(new CustomEvent('audio:play', { detail: 'success' }));
    }
  }

  // Additional command handlers would be implemented here...
}

export default new CLISimulator();
