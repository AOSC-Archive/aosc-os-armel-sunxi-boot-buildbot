//alert('Please notice this virtual terminal is read-only!');
(function ($){
  var timer, build_info, last_ack, interactive, socket;
  var input_buffer = '';
  var _startConsole = function () {
    hterm.defaultStorage = new lib.Storage.Local();
    var terminal = new hterm.Terminal();
    AOSCHypoxia.terminal = terminal;
    terminal.prefs_.set("send-encoding", "raw");
    terminal.prefs_.set("receive-encoding", "utf-8");
    terminal.prefs_.set("ctrl-c-copy", true);
    terminal.prefs_.set("ctrl-v-paste", true);
    terminal.prefs_.set('use-default-window-copy', true);
    terminal.prefs_.set('font-family',
                '"DejaVu Sans Mono for Powerline", "DejaVu Sans Mono", "Everson Mono", "FreeMono", "Menlo", "Lucida Console", "Terminal", "Source Code Pro", "monospace"'
            );
    terminal.onTerminalReady = function() {
        document.querySelector('#status').innerHTML = 'Connecting...';
        terminal.io.print('Connecting you to AOSC Insomnia PTY...');
        terminal.io.onVTKeystroke = function(str) {
            teletype(str);
            if (input_buffer == 'lionsoul') {
                interactive = true;
                start_interactive();
            }
        };
        socket_connect();
       terminal.io.sendString = function(str) {};
       terminal.io.onTerminalResize = function(columns, rows) {};

    };
    terminal.decorate(document.querySelector('#terminal'));
    terminal.installKeyboard();
  }

  function teletype(str, echo = undefined, cmd_callback) {
      // for (i = 0; i < str.length; i++) {
      //     console.log(str.charCodeAt(i));
      // }
      var terminal = AOSCHypoxia.terminal;
      if (str[0] == '\x1b') { // Escape
          if (str == '\x1b\x5b\x31\x35\x7e') { // F5 key
              location.reload();
          } else {
              return;
          }
      }
      if (str == '\x0d') {
          if (echo) {terminal.io.println('');}
          if (cmd_callback) {
              var copy = input_buffer;
              input_buffer = '';
              cmd_callback(copy);
              return;
          }
      }
      if (str == '\x7f') {
          if (echo && input_buffer) {
              terminal.io.print('\b \b');
          }
          input_buffer = input_buffer.slice(0, input_buffer.length - 1);
          return;
      } else {
          input_buffer += str;
      }
      if (echo) {
          terminal.io.print(str);
      }
  }

  function socket_connect() {
      socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + '/insomnia_build_api', {
          transports: ['websocket', 'polling']
      });
      socket.on('connect', function() {
          document.querySelector('#status').innerHTML = 'Ready';
          AOSCHypoxia.terminal.ringBell();
          AOSCHypoxia.terminal.io.print(' connected!');
          if (last_ack) {
              socket.emit('hello', last_ack);
              return;
          }
          socket.emit('hello', undefined);
      });
      socket.on('termupdate', function(data) {
          if (!interactive) {
              AOSCHypoxia.terminal.io.print(data);
          }
      });
      socket.on('termrst', function() {
        AOSCHypoxia.terminal.clearHome();
        AOSCHypoxia.terminal.io.print('\r');
      });
      socket.on('renderfile', function(data) {
          AOSCHypoxia.terminal.io.print(data);
      });
      socket.on('message', function(data) {
          AOSCHypoxia.terminal.io.print(data);
      });
      socket.on('buildinfo', function(data) {
          if (!data.id) {return;}
          build_info = data;
          document.querySelector('#status').innerHTML = 'Build ID: <strong>' + data.id + '</strong>&nbsp;Build Time: <span id=\"hour\">?</span>h<span id=\"min\">?</span>m<span id=\"sec\">?</span>s';
          if (data.stop) {render_time(data.stop - data.start); return;}
          timer = setInterval(function() {
              build_timer(data);
          }, 500);
      });
      socket.on('buildstop', function(time) {
          clearInterval(timer);
          render_time(time - build_info.start);
      });
      socket.on('logview', function(data) {
          AOSCHypoxia.terminal.io.print(data + '\r\n');
      });
      socket.on('disconnect', function() {
          last_ack = Date.now() / 1000;
          AOSCHypoxia.terminal.ringBell();
          if (timer) {
              clearInterval(timer);
          }
          AOSCHypoxia.terminal.io.print('Disconnected...');
          document.querySelector('#status').innerHTML = 'Reconnecting...';

      });
  }

  function build_timer(data) {
      var delta = (Date.now() - data.start * 1000) / 1000;
      render_time(delta);
  }

  function render_time(raw_time) {
      var hours = Math.floor(raw_time / 3600);
      if (hours < 10) hours = '0' + hours;
      document.getElementById('hour').innerHTML = hours;
      var minutes = Math.floor((raw_time % 3600) / 60);
      if (minutes < 10) minutes = '0' + minutes;
      document.getElementById('min').innerHTML = minutes;
      var seconds = Math.floor(raw_time % 60);
      if (seconds < 10) seconds = '0' + seconds;
      document.getElementById('sec').innerHTML = seconds;
  }


  function start_interactive() {
      alert('interactive session activated!');
      term_reset();
      AOSCHypoxia.terminal.io.println('Welcome to AOSC Insomnia Log Terminal!');
      AOSCHypoxia.terminal.io.println('Please type `help` for help.');
      AOSCHypoxia.terminal.io.print('> ');
      input_buffer = '';
      AOSCHypoxia.terminal.io.onVTKeystroke = function(str) {
          teletype(str, true, cmd_process);
      }
  }


  function term_reset() {
      AOSCHypoxia.terminal.clearHome();
      AOSCHypoxia.terminal.io.print('\r');
  }


  function cmd_process(input) {
      var terminal = AOSCHypoxia.terminal;
      function cmd_next() {
          terminal.io.print('\r> ')
      }
      function logview(args) {
          if (args.length > 1) {
            socket.emit('logview', args[1]);
          } else {
            socket.emit('logview', 'ls');
          }
      }
      if (!input.trim()) {
          cmd_next();
          return;
      }
      var cmd = input.trimLeft().split(' ');
      switch (cmd[0]) {
      case 'help':
          terminal.io.print('Currently defined commands:\r\nhelp\tls\texit\tlogview\r\nclear\r\n');
          break;
      case 'exit':
          terminal.io.print('Sorry to see you go...\r\n');
          location.reload();
          return;
      case 'echo':
          terminal.io.print(cmd[1] + '\r\n');
          break;
      case 'ls':
          terminal.io.print('ls: Permission denied ;-)\r\n');
          break;
      case 'logview':
          logview(cmd);
          break;
      case 'clear':
          term_reset();
          break;
      default:
          terminal.io.print(cmd[0] + ': command not found\r\n');
      }
      cmd_next();
  }

  $.extend(true, window, {
    'AOSCHypoxia': {
      'terminal': null,
      'socketio': null,
      'startConsole': _startConsole
    }
  });
})(jQuery);
