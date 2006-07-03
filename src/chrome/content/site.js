var site = null;

function initialise(type)
{
  var nodes = document.getElementsByTagName(type);
  for (var i=0; i<nodes.length; i++)
  {
    nodes[i].value = MultiPass.getStringProperty(site, nodes[i].id);
  }
}

function save(type)
{
  var nodes = document.getElementsByTagName(type);
  for (var i=0; i<nodes.length; i++)
  {
    MultiPass.setStringProperty(site, nodes[i].id, nodes[i].value);
  }
}

function load()
{
  site = MultiPass.gRDF.GetResource(window.arguments[0]);
  initialise("textbox");
  initialise("menulist");
}

function accept()
{
  save("textbox");
  save("menulist");
  MultiPass.flush();
}

window.addEventListener("load", load, false);
