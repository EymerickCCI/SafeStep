CREATE TABLE IF NOT EXISTS users (
  id int(11) NOT NULL AUTO_INCREMENT,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  role enum('technicien','chef_de_chantier','admin') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS sites (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  gps_lat decimal(10,8) DEFAULT NULL,
  gps_lng decimal(11,8) DEFAULT NULL,
  ville varchar(100) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS epis (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) DEFAULT NULL,
  site_id int(11) DEFAULT NULL,
  tag_ref varchar(100) NOT NULL,
  status enum('conforme','a_inspecter','endommage','en_maintenance') NOT NULL,
  category enum('casque','harnais','detecteur_gaz','gants','gilet','autre') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tag_ref (tag_ref),
  KEY user_id (user_id),
  KEY site_id (site_id),
  CONSTRAINT epis_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT epis_ibfk_2 FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS meteo (
  id varchar(36) NOT NULL,
  site_id int(11) NOT NULL,
  temperature decimal(5,2) DEFAULT NULL,
  wind_speed decimal(5,2) DEFAULT NULL,
  precipitation_mm decimal(5,2) DEFAULT NULL,
  forecast_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY site_id (site_id),
  CONSTRAINT meteo_ibfk_1 FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS site_epi (
  id int(11) NOT NULL AUTO_INCREMENT,
  epi_id int(11) NOT NULL,
  site_id int(11) NOT NULL,
  PRIMARY KEY (id),
  KEY epi_id (epi_id),
  KEY site_id (site_id),
  CONSTRAINT site_epi_ibfk_1 FOREIGN KEY (epi_id) REFERENCES epis (id) ON DELETE CASCADE,
  CONSTRAINT site_epi_ibfk_2 FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS site_user (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  site_id int(11) NOT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY site_id (site_id),
  CONSTRAINT site_user_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT site_user_ibfk_2 FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS sync_events (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  entity_type varchar(100) NOT NULL,
  epi_id int(11) DEFAULT NULL,
  action enum('CREATE','UPDATE','DELETE') NOT NULL,
  client_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  server_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY epi_id (epi_id),
  CONSTRAINT sync_events_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT sync_events_ibfk_2 FOREIGN KEY (epi_id) REFERENCES epis (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
