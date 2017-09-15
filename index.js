var Serial = require('serialport');
var port = new Serial('/dev/tty.usbserial', { autoOpen: false });

var command_read = new Uint8Array([0x10, 0x02, 0x02, 0x01, 0x12, 0x00, 0x01, 0x01, 0xF4, 0xCE, 0x10, 0x03]);

const STARTX_FIRST = 1;
const STARTX_SECOND = 2;
const HEADER = 3;
const BODY = 4;
const CRC = 5;
const ENDX = 6;

var response_header = [];
var response_body = [];

var packet_status = STARTX_FIRST;
var body_length = 0;

function read_startx() {
  var packet = port.read(1);
  if(!packet)
		return;

  if(packet_status == STARTX_FIRST) {
		if(packet[0] == 0x10) {
			packet_status = STARTX_SECOND;
	//		read_startx();
		}
		console.log('STARTX : ', packet);
  } else { // STARTX_SECOND
		if(packet[0] == 0x02) {
			response_body = [];
			response_header = [];

			console.log('STARTX : ', packet);

 			packet_status = HEADER;
			read_header();
		}
  }
}

function read_header() {
  var packet = port.read(5);
  if(!packet)
		return;

	response_header.push(...packet);
 	body_length = (response_header[3] << 8) + response_header[4];     

	console.log('HEADER : ', packet, body_length);

 	packet_status = BODY; 
	read_body();
}

function read_body() {
  var packet = port.read(body_length);
  if(!packet)
		return;

	response_body.push(...packet);

  var escape_count = 0;
	var escaped = false;

  for(var i = 0;i < response_body.length;i++) {
  	if(response_body[i] == 0x10) {
			if(escaped) {
				response_body.splice(i, 1);
				i--;
				escape_count++;
				escaped = false;
				console.log('---------ESCAPED---------------\n');
			} else {
				escaped = true;
			}
		} else {
			escaped = false;
		}
	}

  if(escape_count > 0) {
		body_length = escape_count;
		read_body();
	} else {
		console.log('BODY : ', Buffer.from(response_body));

 		packet_status = CRC; 
		read_crc();
	}
}

function read_crc() {
  var packet = port.read(2);
  if(!packet)
		return;

	console.log('CRC : ', packet);

 	packet_status = ENDX; 
	read_endx();
}

function read_endx() {
  var packet = port.read(2);
  if(!packet)
		return;

	console.log('ENDX : ', packet);

 	packet_status = STARTX_FIRST; 
	read_startx();
}

port.open(err => {
	if(err) {
	  console.error(err);
		return;
	}

	port.write(command_read);
  setInterval(() => {
		port.write(command_read);
  }, 1000);
});

port.on('readable', () => {
  switch(packet_status) {
	case STARTX_FIRST:
	case STARTX_SECOND:
		read_startx();
		break;
	case HEADER:
		read_header();
		break;
	case BODY:
		read_body();
		break;
	case CRC:
		read_crc();
		break;
	case ENDX:
		read_endx();
		break;
	}
}); 
