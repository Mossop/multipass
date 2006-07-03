const Cc = Components.classes;
const Ci = Components.interfaces;
const DROP_ON = Ci.nsIXULTreeBuilderObserver.DROP_ON;
const DROP_BEFORE = Ci.nsIXULTreeBuilderObserver.DROP_BEFORE;
const DROP_AFTER = Ci.nsIXULTreeBuilderObserver.DROP_AFTER;
const DS = Cc["@mozilla.org/widget/dragservice;1"]
             .getService(Ci.nsIDragService);
const COPY_OR_LINK = Ci.nsIDragService.DRAGDROP_ACTION_COPY + Ci.nsIDragService.DRAGDROP_ACTION_LINK;

var gTree = null;

var treeObserver = {
  getItems: function(dragSession)
  {
    var ioservice = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    var trans = Cc["@mozilla.org/widget/transferable;1"]
                  .createInstance(Ci.nsITransferable);
    trans.addDataFlavor("moz/rdfitem");
    trans.addDataFlavor("text/x-moz-url");
    var uri;
    var items = [];
    for (var i = 0; i < dragSession.numDropItems; i++)
    {
      var bestFlavour = {}, dataObj = {}, len = {};
      dragSession.getData(trans, i);
      trans.getAnyTransferData(bestFlavour, dataObj, len);

      dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
      if (!dataObj)
        continue;

      dataObj = dataObj.data.substring(0, len.value).split("\n");
      uri     = dataObj[0];

      switch (bestFlavour.value)
      {
        case "moz/rdfitem":
          uri = MultiPass.gRDF.GetResource(uri);
          break;
        case "text/x-moz-url":
          uri = ioservice.newURI(uri, "UTF8", null);
          break;
      }

      items.push(uri);
    }
    return items;
  },

  canDropItem: function(source, srctype, target, targtype, copying)
  {
    if (copying && srctype != "login")
      return false;
    if (srctype == "site" && targtype != "group")
      return false;
    if (srctype == "group" && targtype != "group")
      return false;
    if (srctype == "login" && targtype != "site")
      return false;
    if (copying)
      return true;

    var item = target;
    while (item && item != source)
      item = MultiPass.getContainer(item);

    return (item != source);
  },
    
  canDrop: function(index, orientation)
  {
    var dragSession = DS.getCurrentSession();
    if (!dragSession)
      return false;

    if ((!dragSession.isDataFlavorSupported("moz/rdfitem")) &&
        (!dragSession.isDataFlavorSupported("text/x-moz-url")))
      return false;
      
    var builder = gTree.view.QueryInterface(Ci.nsIXULTreeBuilder);
    if (orientation == DROP_AFTER && gTree.view.isContainerOpen(index))
    {
      if (gTree.view.isContainerEmpty(index))
        orientation == DROP_ON;
      else
      {
        orientation == DROP_BEFORE;
        index++;
      }
    }
    var target = builder.getResourceAtIndex(index);
    var parent = target;
    if (orientation == DROP_BEFORE || orientation == DROP_AFTER)
      parent = MultiPass.getContainer(target);
    var type = MultiPass.getStringProperty(parent, "mp:type");
    var copying = (dragSession.dragAction & COPY_OR_LINK);
    /*dump("canDrop "+target.Value+" "+type+" ");
    if (orientation == DROP_BEFORE)
      dump("BEFORE\n");
    if (orientation == DROP_AFTER)
      dump("AFTER\n");
    if (orientation == DROP_ON)
      dump("ON\n");*/
    
    if (type=="login")
      return false;

    var items = this.getItems(dragSession);
    for (var i = 0; i<items.length; i++)
    {
      if (items[i] instanceof Ci.nsIRDFResource)
      {
        var srctype = MultiPass.getStringProperty(items[i], "mp:type");
        if (!this.canDropItem(items[i], srctype, parent, type, copying))
          return false;
      }
      else if (type != "group")
        return false;
    }

    return true;
  },

  onDrop: function(index, orientation)
  {
    var dragSession = DS.getCurrentSession();
    if (!dragSession)
      return;
      
    var builder = gTree.view.QueryInterface(Ci.nsIXULTreeBuilder);
    if (orientation == DROP_AFTER && gTree.view.isContainerOpen(index))
    {
      if (gTree.view.isContainerEmpty(index))
        orientation == DROP_ON;
      else
      {
        orientation == DROP_BEFORE;
        index++;
      }
    }
    var target = builder.getResourceAtIndex(index);
    var parent = target;
    if (orientation == DROP_BEFORE || orientation == DROP_AFTER)
      parent = MultiPass.getContainer(parent);
    var type = MultiPass.getStringProperty(parent, "mp:type");
    var copying = (dragSession.dragAction & COPY_OR_LINK);
    
    var items = this.getItems(dragSession);
    for (var i = 0; i<items.length; i++)
    {
      if (items[i] instanceof Ci.nsIRDFResource)
      {
        var srctype = MultiPass.getStringProperty(items[i], "mp:type");
        if (!this.canDropItem(items[i], srctype, parent, type, copying))
          continue;
          
        var container;
        var item = items[i];
        var utils = Cc["@mozilla.org/rdf/container-utils;1"]
                      .getService(Ci.nsIRDFContainerUtils);
        if (copying && srctype == "login")
        {
          var login = MultiPass.gRDF.GetAnonymousResource();
          MultiPass.setStringProperty(login, "type", "login");
          MultiPass.setStringProperty(login, "name", MultiPass.getStringProperty(item, "name"));
          MultiPass.setStringProperty(login, "password", MultiPass.getStringProperty(item, "password"));
          MultiPass.setBoolProperty(login, "working", MultiPass.getBoolProperty(item, "working"));
          item = login;
        }
        else
        {
          var oldparent = MultiPass.getContainer(item);
          container = utils.MakeSeq(MultiPass.gDS, oldparent);
          container.RemoveElement(item,true);
        }
        container = utils.MakeSeq(MultiPass.gDS, parent);
        if (orientation == DROP_AFTER || orientation == DROP_BEFORE)
        {
          var pos = container.IndexOf(target);
          if (orientation == DROP_AFTER)
            pos++;
          container.InsertElementAt(item, pos, true);
        }
        else
          container.AppendElement(item);
      }
      else if (type == "group")
        MultiPass.addURL(items[i], target);
    }
    MultiPass.flush();
    gTree.builder.rebuild();
  },

  onToggleOpenState: function (aRow) { },
  onCycleHeader: function (aColumnID, aHeaderElement) { },
  onSelectionChanged: function () { },
  onCycleCell          : function (aItemIndex, aColumnID)          {},
  onPerformAction      : function (aAction)                        {},
  onPerformActionOnRow : function (aAction, aItemIndex)            {},
  onPerformActionOnCell: function (aAction, aItemIndex, aColumnID) {}

}

var DNDObserver = {
  onDragStart: function (aEvent, aXferData, aDragAction)
  {
    var resource = getCurrentResource();
    var type = MultiPass.getStringProperty(resource, "mp:type");
    aXferData.data = new TransferData();
    
    aXferData.data.addDataForFlavour("moz/rdfitem", resource.Value);
    if (type == "site")
      aXferData.data.addDataForFlavour("text/x-moz-url", MultiPass.getStringProperty(resource, "uri"));

    if (aEvent.ctrlKey)
      aDragAction.action = Ci.nsIDragService.DRAGDROP_ACTION_COPY;
  },

  onDragOver: function (aEvent, aFlavour, aDragSession)
  {
    if (aDragSession.sourceNode == gTree)
      aDragSession.canDrop = true;
  },

  // the actual dropping happens in the nsIXULTreeBuilderObserver below
  onDrop: function (aEvent, aXferData, aDragSession) { },

  getSupportedFlavours: function ()
  {
    var flavourSet = new FlavourSet();
    flavourSet.appendFlavour("moz/rdfitem");
    flavourSet.appendFlavour("text/x-moz-url");
    return flavourSet;
  }
}

function getCurrentResource()
{
  if (gTree.currentIndex>=0)
  {
    var builder = gTree.view.QueryInterface(Ci.nsIXULTreeBuilder);
    return builder.getResourceAtIndex(gTree.currentIndex);
  }
  return null;
}

function properties()
{
  var resource = getCurrentResource();
  var type = MultiPass.getStringProperty(resource, "mp:type");
  
  if (type == "site")
    window.openDialog("chrome://multipass/content/site.xul", "_blank", "chrome,all,dialog=yes,modal", resource.Value);
}

function deleteItem()
{
  var resource = getCurrentResource();
  MultiPass.deleteItem(resource);
  MultiPass.flush();
}

function addGroup()
{
  var resource = getCurrentResource();
  var type = MultiPass.getStringProperty(resource, "mp:type");
  if (type == "site")
    resource = MultiPass.getContainer(resource);
    
  var bundle = document.getElementById("bundle");
  var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Ci.nsIPromptService);
  var name = { value: bundle.getString("newgroup.default") };
  if (promptService.prompt(window,
                           bundle.getString("newgroup.title"), 
                           bundle.getString("newgroup.text"), 
                           name, null, {}))
  {
    MultiPass.addGroup(resource, name.value);
    MultiPass.flush();
    gTree.builder.rebuild();
  }
}

function loadItem(newtab, newwindow)
{
  var resource = getCurrentResource();
  var type = MultiPass.getStringProperty(resource, "mp:type");
  
  if (type=="site")
  {
    var logins = MultiPass.getContents(resource);
    for (var i = 0; i<logins.length; i++)
    {
      if (MultiPass.getBoolProperty(logins[i], "mp:working"))
      {
        MultiPass.loadLogin(resource, logins[i], newtab, newwindow);
        break;
      }
    }
    return true;
  }
  else if (type=="login")
  {
    MultiPass.loadLogin(null, resource, newtab, newwindow);
    return true;
  }
  return false;
}

function flipLogin()
{
  var resource = getCurrentResource();
  MultiPass.setBoolProperty(resource, "mp:working", !MultiPass.getBoolProperty(resource, "mp:working"));
  MultiPass.flush();
}

function onPopupShowing(event)
{
  var resource = getCurrentResource();
  var type = MultiPass.getStringProperty(resource, "mp:type");
  var context = document.getElementById("context");
  var result = false;
  
  var item = context.firstChild;
  while (item)
  {
    if (item.hasAttribute("types"))
      item.hidden = (item.getAttribute("types").indexOf(type)<0)
    
    if (!item.hidden)
      result = true;
      
    item = item.nextSibling;
  }
  
  if (type=="login")
  {
    item = document.getElementById("working");
    item.setAttribute("checked", MultiPass.getBoolProperty(resource, "mp:working"));
  }
  
  return result;
}

function onKeyPress(event)
{
  if (event.keyCode==13)
  {
    loadItem(event.ctrlKey, event.shiftKey);
    event.stopPropagation();
  }
}

function onClick(event)
{
  if (event.button==1)
    loadItem(true, false);
  if (event.detail==2)
  {
    var resource = getCurrentResource();
    var type = MultiPass.getStringProperty(resource, "mp:type");
    if (type != "group")
      event.stopPropagation();
  }
}

function onDoubleClick(event)
{
  if (event.button==0)
  {
    loadItem(event.ctrlKey, event.shiftKey);
  }
}

function showImporter()
{
  openDialog("chrome://multipass/content/importer.xul", "_blank", "chrome,all,dialog=no");
}

function rdfImport(overwrite)
{
	var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	fp.init(window, "Select RDF file", fp.modeOpen);
	fp.appendFilter("RDF Files (*.rdf)", "*.rdf");
	fp.appendFilter("All Files (*.*)", "*.*");
		
	if (fp.show() != fp.returnOK)
	  return;

  MultiPass.importRDF(fp.file, overwrite);
}

function init(event)
{
  MultiPass.init(event);
  gTree = document.getElementById("maintree");
  gTree.addEventListener("keypress", onKeyPress, true);
  gTree.addEventListener("dblclick", onDoubleClick, true);
  gTree.addEventListener("click", onClick, true);
  gTree.database.AddDataSource(MultiPass.gDS);
  var builder = gTree.builder;
  builder.rebuild();
  builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  builder.addObserver(treeObserver);
}

window.addEventListener("load", init, false);
