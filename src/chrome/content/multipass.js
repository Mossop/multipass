function MultiPassLoadListener(site, login, browser)
{
  this.site = site;
  this.login = login;
  this.browser = browser;
  var self = this;
  this.listener = function(event) { self.onContentLoaded(event) };
  browser.addEventListener("load", this.listener, true);
}

MultiPassLoadListener.prototype = {
  site: null,
  login: null,
  browser: null,
  
  inputSetter: function(document, path, value)
  {
    var result = document.evaluate(path,
                                   document, 
                                   null,
                                   XPathResult.ANY_TYPE,
                                   null);
    var inputs = [];
    var node = result.iterateNext();
    while (node)
    {
      inputs.push(node);
      node = result.iterateNext();
    }
    for (var i = 0; i<inputs.length; i++)
      inputs[i].value = value;
  },
  
  onContentLoaded: function(event)
  {
    if (event.target != this.browser.contentDocument)
      return;
    this.browser.removeEventListener("load", this.listener, true);
    var namepath = "//input[@name=\""+MultiPass.getStringProperty(this.site, "usernamefield")+"\"]"
    this.inputSetter(event.target, namepath, MultiPass.getStringProperty(this.login, "name"));
    var passpath = "//input[@name=\""+MultiPass.getStringProperty(this.site, "passwordfield")+"\"]"
    this.inputSetter(event.target, passpath, MultiPass.getStringProperty(this.login, "password"));
    var fieldpath = "//input[@name=\""+MultiPass.getStringProperty(this.site, "captchafield")+"\"]"
    var result = event.target.evaluate(fieldpath,
                                       event.target, 
                                       null,
                                       XPathResult.ANY_TYPE,
                                       null);
    var node = result.iterateNext();
    if (node)
      node.focus();
  }
}

var MultiPass = {
  gRDF: Components.classes["@mozilla.org/rdf/rdf-service;1"]
                  .getService(Components.interfaces.nsIRDFService),
  gDS: null,
  browserWindow: window.top,
  
  init: function(event)
  {
    window.removeEventListener("load", MultiPass.init, false);
    
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
                      getService(Components.interfaces.nsIIOService);
    var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].
                      getService(Components.interfaces.nsIProperties);
  
    var datafile = directoryService.get("ProfD",Components.interfaces.nsIFile);
    datafile.append("multipass.rdf");
    
    this.gDS = this.gRDF.GetDataSourceBlocking(ioService.newFileURI(datafile).spec);
    
    var root = this.getRootGroup();
    this.setStringProperty(root, "type", "group");
    
    if ("arguments" in window && window.arguments.length==6)
    {
      var login = this.gRDF.GetResource(window.arguments[5]);
      this.loadLogin(null, login, false, false);
    }
  },
  
  _importGroup: function(parent, ds, group, overwrite)
  {
    dump("Importing group "+group.Value+"\n");
    var newgroup = null;
    var name = ds.GetTarget(group, this.getPropertyResource("name"), true);
    name = name.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    var groups = this.getContents(parent);
    for (var i=0; i<groups.length; i++)
    {
      if (this.getStringProperty(groups[i], "name") == name)
        newgroup = groups[i];
    }
    if (!newgroup)
      newgroup = this.addGroup(parent, name);

    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var seq = utils.MakeSeq(ds, group);
    var elements = seq.GetElements();
    while (elements.hasMoreElements())
    {
      var item = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var type = ds.GetTarget(item, this.getPropertyResource("type"), true);
      if (type)
      {
        type = type.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        if (type == "group")
          this._importGroup(newgroup, ds, item, overwrite);
        else if (type == "site")
          this._importSite(newgroup, ds, item, overwrite);
      }
    }
  },
  
  _importSite: function(parent, ds, site, overwrite)
  {
    dump("Importing site "+site.Value+"\n");
    var ioservice = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);

    var url = ds.GetTarget(site, this.getPropertyResource("uri"), true);
    url = url.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    var type = ds.GetTarget(site, this.getPropertyResource("security"), true);
    type = type.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    var userfield = ds.GetTarget(site, this.getPropertyResource("userfield"), true);
    if (userfield)
      userfield = userfield.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    var passfield = ds.GetTarget(site, this.getPropertyResource("passfield"), true);
    if (passfield)
      passfield = passfield.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

    url = ioservice.newURI(url, "UTF8", null);
    var siteres = url.hostPort;
    if (siteres.substring(0,4) == "www.")
      siteres = siteres.substring(4);
    else if (siteres.substring(0,8) == "members.")
      siteres = siteres.substring(8);
    var nsite = this.gRDF.GetResource(url.scheme+"://"+siteres);
    if (!this.gDS.hasArcOut(site, this.getPropertyResource("type")))
    {
      nsite = this.addURL(url, parent, type, userfield, passfield);
    }
    else if (overwrite)
    {
      this.setURIProperty(nsite, "uri", url);
      this.setStringProperty(nsite, "security", type);
      if (userfield)
        this.setStringProperty(nsite, "userfield", userfield);
      if (passfield)
        this.setStringProperty(nsite, "passfield", passfield);
      if (this.getContainer(nsite) != parent)
      {
        var container = utils.MakeSeq(this.gDS, this.getContainer(nsite));
        container.RemoveElement(nsite, true);
        container = utils.MakeSeq(this.gDS, parent);
        container.AppendElement(nsite);
      }
    }
    var seq = utils.MakeSeq(ds, site);
    var elements = seq.GetElements();
    while (elements.hasMoreElements())
    {
      var item = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var type = ds.GetTarget(item, this.getPropertyResource("type"), true);
      if (type && type.QueryInterface(Components.interfaces.nsIRDFLiteral).Value == "login")
      {
        var name = ds.GetTarget(item, this.getPropertyResource("name"), true);
        name = name.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        var pass = ds.GetTarget(item, this.getPropertyResource("password"), true);
        pass = pass.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        var working = ds.GetTarget(item, this.getPropertyResource("working"), true);
        working = working.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        url.username = name;
        url.password = pass;
        var login = this.addURL(url);
        if (overwrite)
          this.setStringProperty(login, "working", working);
      }
    }
  },
  
  importRDF: function(datafile, overwrite)
  {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
                      getService(Components.interfaces.nsIIOService);
    var ds = this.gRDF.GetDataSourceBlocking(ioService.newFileURI(datafile).spec);
    var type = this.getPropertyResource("type");
    var group = this.gRDF.GetLiteral("group");
    var site = this.gRDF.GetLiteral("site");

    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var seq = utils.MakeSeq(ds, this.getRootGroup());
    var elements = seq.GetElements();
    while (elements.hasMoreElements())
    {
      var item = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var typ = ds.GetTarget(item, type, true);
      if (typ)
      {
        typ = typ.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        if (typ == "site")
          this._importSite(this.getRootGroup(), ds, item, overwrite);
        else if (typ == "group")
          this._importGroup(this.getRootGroup(), ds, item, overwrite);
      }
    }
    
    var items = ds.GetSources(type, group, true);
    while (items.hasMoreElements())
    {
      var item = items.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      if (item.Value == "urn:multipass:root")
        continue;
      var arcs = ds.ArcLabelsIn(item);
      if (!arcs.hasMoreElements())
        this._importGroup(this.getRootGroup(), ds, item, overwrite);
    }

    var items = ds.GetSources(type, site, true);
    while (items.hasMoreElements())
    {
      var item = items.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var arcs = ds.ArcLabelsIn(item);
      if (!arcs.hasMoreElements())
        this._importSite(this.getRootGroup(), ds, item, overwrite);
    }
  },
  
  addGroup: function(parent, name)
  {
    if (!parent)
      parent = this.getRootGroup();
    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var group = this.gRDF.GetAnonymousResource();
    this.setStringProperty(group, "type", "group");
    this.setStringProperty(group, "name", name);
    utils.MakeSeq(this.gDS, group);
    var container = utils.MakeSeq(this.gDS, parent);
    container.AppendElement(group);
    return group;
  },
  
  addURL: function(url, group, type, userfield, passfield)
  {
    if (!group)
      group = this.getRootGroup();
    
    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);

    var siteres = url.hostPort;
    if (siteres.substring(0,4) == "www.")
      siteres = siteres.substring(4);
    else if (siteres.substring(0,8) == "members.")
      siteres = siteres.substring(8);
    var site = this.gRDF.GetResource(url.scheme+"://"+siteres);
    if (!this.gDS.hasArcOut(site, this.getPropertyResource("type")))
    {
      var sitecontainer = utils.MakeSeq(this.gDS, group);
      sitecontainer.AppendElement(site);
      this.setStringProperty(site, "type", "site");
      this.setStringProperty(site, "name", siteres);
      var target = url.clone();
      target.userPass = null;
      this.setURIProperty(site, "uri", target);

      if (type)
        this.setStringProperty(site, "security", type);
      else if (userfield && passfield)
        this.setStringProperty(site, "security", "captcha");
      else
        this.setStringProperty(site, "security", "auth");

      if (userfield && passfield)
      {
        this.setStringProperty(site, "usernamefield", userfield);
        this.setStringProperty(site, "passwordfield", passfield);
      }
    }
    if (url.userPass)
    {
      var logins = this.getContents(site);
      for (var i=0; i<logins.length; i++)
      {
        if ((this.getStringProperty(logins[i], "name") == url.username) &&
            (this.getStringProperty(logins[i], "password") == url.password))
          return logins[i];
      }
      var login = this.gRDF.GetAnonymousResource();
      this.setStringProperty(login, "type", "login");
      this.setStringProperty(login, "name", url.username);
      this.setStringProperty(login, "password", url.password);
      this.setBoolProperty(login, "working", true);
      var container = utils.MakeSeq(this.gDS, site);
      container.AppendElement(login);
      return login;
    }
    else
      return site;
  },
  
  deleteItem: function(resource)
  {
    var type = this.getStringProperty(resource, "type");
    if (type != "login")
    {
      var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                            .getService(Components.interfaces.nsIRDFContainerUtils);
      var container = utils.MakeSeq(this.gDS, resource);
      var elements = container.GetElements();
      while (elements.hasMoreElements())
      {
        var item = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        container.RemoveElement(item, true);
        this.deleteItem(item);
      }
    }
    var properties = this.gDS.ArcLabelsOut(resource);
    while (properties.hasMoreElements())
    {
      var property = properties.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var targets = this.gDS.GetTargets(resource, property, true);
      while (targets.hasMoreElements())
      {
        var target = targets.getNext().QueryInterface(Components.interfaces.nsIRDFNode);
        this.gDS.Unassert(resource, property, target);
      }
    }
  },
  
  loadLogin: function (site, login, newtab, newwindow)
  {
    if (!site)
      site = this.getContainer(login);
    if (!site)
      return;
    
    if (!newtab && newwindow)
    {
      this.browserWindow.openDialog(this.browserWindow.getBrowserURL(), "_blank", "chrome,all,dialog=no", "about:blank", null, null, null, false, login.Value);
      return;
    }
    
    var tabbrowser = this.browserWindow.document.getElementById("content");
    if (newtab)
      tabbrowser.selectedTab = tabbrowser.addTab("about:blank");
    var browser = tabbrowser.selectedBrowser;
      
    var uri = this.getURLProperty(site, "uri");
    var referer = this.getURIProperty(site, "referer");
    
    var security = this.getStringProperty(site, "security");
    if (security == "auth")
    {
      uri.username = this.getStringProperty(login, "name");
      uri.password = this.getStringProperty(login, "password");
      browser.loadURI(uri.spec, referer, null);
    }
    else if (security == "form")
    {
      var query = "";
      query+=this.getStringProperty(site, "usernamefield");
      query+="="+this.getStringProperty(login, "name")+"&";
      query+=this.getStringProperty(site, "passwordfield");
      query+="="+this.getStringProperty(login, "password");
      if (this.getStringProperty(site, "method") == "GET")
      {
        uri.query = query;
        browser.loadURI(uri.spec, referer, null);
      }
      else
        browser.loadURIWithFlags(uri.spec, 
                                 Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE,
                                 referer, null, query);
    }
    else if (security == "captcha")
    {
      var listener = new MultiPassLoadListener(site, login, browser);
      browser.loadURI(uri.spec, referer, null);
    }
  },
  
  getRootGroup: function()
  {
    return this.gRDF.GetResource("urn:multipass:root");
  },
  
  getContainer: function(resource)
  {
    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var arcs = this.gDS.ArcLabelsIn(resource);
    while (arcs.hasMoreElements())
    {
      var arc = arcs.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      if (utils.IsOrdinalProperty(arc))
      {
        return this.gDS.GetSource(arc, resource, true);
        break;
      }
    }
    return null;
  },
  
  getContents: function(resource)
  {
    var utils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var result = [];
    var seq = utils.MakeSeq(this.gDS, resource);
    var elements = seq.GetElements();
    while (elements.hasMoreElements())
    {
      result.push(elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource));
    }
    return result;
  },
  
  getPropertyResource: function(property)
  {
    if (property.substring(0,4) == "rdf:")
      return this.gRDF.GetResource("http://www.w3.org/1999/02/22-rdf-syntax-ns#"+property.substring(4));
    else if (property.substring(0,3) == "mp:")
      property = property.substring(3);
    return this.gRDF.GetResource("urn:multipass:properties#"+property);
  },
  
  getProperty: function(resource, property)
  {
    var prop = this.getPropertyResource(property);
    if (this.gDS.hasArcOut(resource, prop))
      return this.gDS.GetTarget(resource, prop, true);
    else
      return null;
  },
  
  setProperty: function(resource, property, value)
  {
    var prop = this.getPropertyResource(property);
    if (this.gDS.hasArcOut(resource, prop))
    {
      var target = this.gDS.GetTarget(resource, prop, true);
      this.gDS.Change(resource, prop, target, value);
    }
    else
      this.gDS.Assert(resource, prop, value, true);
  },
  
  hasProperty: function(resource, property)
  {
    var prop = this.getPropertyResource(property);
    return this.gDS.hasArcOut(resource, prop);
  },
  
  getStringProperty: function(resource, property)
  {
    var value = this.getProperty(resource, property);
    if (!value)
      return null;
    value = value.QueryInterface(Components.interfaces.nsIRDFLiteral);
    return value.Value;
  },
  
  setStringProperty: function(resource, property, value)
  {
    value = this.gRDF.GetLiteral(value);
    this.setProperty(resource, property, value);
  },
  
  getBoolProperty: function(resource, property)
  {
    return this.getStringProperty(resource, property)=="true";
  },
  
  setBoolProperty: function(resource, property, value)
  {
    if (value)
      value = this.gRDF.GetLiteral("true");
    else
      value = this.gRDF.GetLiteral("false");
    this.setProperty(resource, property, value);
  },
  
  getIntProperty: function(resource, property)
  {
    var value = this.getProperty(resource, property);
    if (!value)
      return null;
    value = value.QueryInterface(Components.interfaces.nsIRDFInt);
    return value.Value;
  },
  
  setIntProperty: function(resource, property, value)
  {
    value = this.gRDF.GetIntLiteral(value);
    this.setProperty(resource, property, value);
  },
  
  getURIProperty: function(resource, property)
  {
    var value = this.getStringProperty(resource, property);
    if (!value)
      return null;
    ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
    return ios.newURI(value, "UTF8", null);
  },
  
  setURIProperty: function(resource, property, value)
  {
    value = this.gRDF.GetLiteral(value.spec);
    this.setProperty(resource, property, value);
  },
  
  getURLProperty: function(resource, property)
  {
    var value = this.getURIProperty(resource, property);
    if (!value)
      return null;
    return value.QueryInterface(Components.interfaces.nsIURL);
  },
  
  setURIProperty: function(resource, property, value)
  {
    value = this.gRDF.GetLiteral(value.spec);
    this.setProperty(resource, property, value);
  },
  
  flush: function()
  {
    this.gDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
  }
}

window.addEventListener("load", function(event) { MultiPass.init(event); }, false);
