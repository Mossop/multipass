const Cc = Components.classes;
const Ci = Components.interfaces;
const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function paste()
{
  var clip = Cc["@mozilla.org/widget/clipboard;1"]
               .getService(Ci.nsIClipboard);
  if (!clip) return false;
  
  var trans = Cc["@mozilla.org/widget/transferable;1"]
                .createInstance(Ci.nsITransferable);
  if (!trans) return false;
  trans.addDataFlavor("text/unicode");
  clip.getData(trans,clip.kGlobalClipboard);

  var str = {};
  var strLength = {};
  
  trans.getTransferData("text/unicode",str,strLength);
  var text = document.getElementById("text");
  
  if (str)
    str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
  if (str)
    text.value = str.data.substring(0,strLength.value / 2);
}

function load()
{
  var bundle = document.getElementById("bundle");
	var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	fp.init(window, bundle.getString("filepicker.title"), fp.modeOpen);
	fp.appendFilter(bundle.getString("filepicker.filtertxt"), "*.txt");
	fp.appendFilter(bundle.getString("filepicker.filterall"), "*.*");
		
	if (fp.show() != fp.returnOK)
	  return;

  var text = document.getElementById("text");
  
	var is = Cc["@mozilla.org/network/file-input-stream;1"]
	           .createInstance(Ci.nsIFileInputStream);
	const PR_RDONLY = 0x01;
	is.init(fp.file, PR_RDONLY, 0, 0);
	if (!(is instanceof Ci.nsILineInputStream))
	  return;
	var contents = "";
	var line = { value: "" };
	do
	{
    var more = is.readLine(line);
    contents+=line.value+"\n";
  } while (more);

  text.value = contents;
}

function addURLToList(url)
{
  var list = document.getElementById("passwords");
  var item = document.createElementNS(XULNS, "listitem");
  item.setAttribute("type", "checkbox");
  item.setAttribute("checked", "true");
  item.setAttribute("label", url.spec);
  item.url = url;
  list.appendChild(item);
}

function findLogin(line)
{
  line=line.replace(/^\s*(.*?)\s*$/, "$1");
  line=line.replace(/\s\s+/, " ");
  line=line.replace(/u(sername)?:/,"");
  line=line.replace(/l(ogin)?:/,"");
  line=line.replace(/p(assword)?:/,"");
  if (line.length==0)
    return null;
    
  var items = line.split(" ");
  if (items.length==2)
    return items[0]+":"+items[1];
  if ((items.length==1) && (items[0].indexOf(":")>0))
    return items[0];
  return null;
}

function findURL(line)
{
  var ioservice = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
  var url = null;
  var basic = /^(.*?)(\S+)(:\/\/\S+)(.*?)$/;
  var results = basic.exec(line);
  if (results)
  {
    var url = results[3];
    if ((results[2] == "ftp") || (results[2] == "https"))
      url = results[2]+url;
    else
      url = "http"+url;
    url = ioservice.newURI(url, "UTF8", null);
    if (!url.userPass)
    {
      var login = findLogin(results[1]+results[4]);
      if (login)
        url.userPass = login;
    }
    return url;
  }

  return null;
}

function parse()
{
  var text = document.getElementById("text");
  
  var lines = text.value.split("\n");
  var unknown = "";
  var incomplete = null;
  for (var i=0; i<lines.length; i++)
  {
    var line = lines[i];

    if (line.match(/^\s*$/))
      continue;

    var url = findURL(line);
    if (url)
    {
      incomplete = null;
      if (url.userPass)
      {
        addURLToList(url);
        continue;
      }
      else
        incomplete = url;
    }
    else if (incomplete)
    {
      var login = findLogin(line);
      if (login)
      {
        var next = incomplete.clone();
        next.userPass = login;
        addURLToList(next);
        continue;
      }
    }
    unknown += line+"\n";
  }
  text.value = unknown;
}

function checkAll()
{
  var list = document.getElementById("passwords");
  var item = list.firstChild;
  while (item)
  {
    if (item.localName == "listitem")
      item.setAttribute("checked", "true");
    item = item.nextSibling;
  }
}

function uncheckAll()
{
  var list = document.getElementById("passwords");
  var item = list.firstChild;
  while (item)
  {
    if (item.localName == "listitem")
      item.setAttribute("checked", "false");
    item = item.nextSibling;
  }
}

function addChecked()
{
  var list = document.getElementById("passwords");
  var item = list.firstChild;
  while (item)
  {
    if ((item.localName == "listitem") && (item.getAttribute("checked") == "true"))
      MultiPass.addURL(item.url);
      
    item = item.nextSibling;
  }
  MultiPass.flush();
}

function removeChecked()
{
  var list = document.getElementById("passwords");
  var item = list.firstChild;
  while (item)
  {
    var next = item.nextSibling;
    if ((item.localName == "listitem") && (item.getAttribute("checked") == "true"))
      list.removeChild(item);
    item = next;
  }
}
