// -*- js-var:Components -*-
/*
 * $HeadURL$
 * $LastChangedBy$
 * $Date$
 * $Revision$
 *
 */

var initModule =
{
  ServiceCID: Components.ID("{c2d2f379-a1dc-4cd6-ab9e-f9274c7124a3}"),
  ServiceContractID: "@mozilla.org/rdf/datasource;1?name=multipass",
  ServiceName: "Multipass RDF datasource",
  Datasource: null,
  
  registerSelf: function (compMgr, fileSpec, location, type)
  {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(this.ServiceCID,this.ServiceName,this.ServiceContractID,
      fileSpec,location,type);
  },

  unregisterSelf: function (compMgr, fileSpec, location)
  {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(this.ServiceCID,fileSpec);
  },

  getClassObject: function (compMgr, cid, iid)
  {
    if (!cid.equals(this.ServiceCID))
      throw Components.results.NS_ERROR_NO_INTERFACE
    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    return this.instanceFactory;
  },

  canUnload: function(compMgr)
  {
    return true;
  },

  instanceFactory:
  {
    createInstance: function (outer, iid)
    {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      if (this.Datasource==null)
      {
        var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"].
                          getService(Components.interfaces.nsIRDFService);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"].
                          getService(Components.interfaces.nsIIOService);
        var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].
                          getService(Components.interfaces.nsIProperties);
      
        var datafile = directoryService.get("ProfD",Components.interfaces.nsIFile);
        datafile.append("multipass.rdf");
        
        var data;
        this.Datasource = rdfService.GetDataSourceBlocking(ioService.newFileURI(datafile).spec);
      }
      return this.Datasource.QueryInterface(iid);
    }
  }
}; //Module

function NSGetModule(compMgr, fileSpec)
{
  return initModule;
}

