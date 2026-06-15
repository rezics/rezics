client {
  host_network "loopback" {
    cidr = "127.0.0.1/32"
  }
}

plugin "docker" {
  config {
    volumes {
      enabled = true
    }
  }
}
