-- Start transaction
BEGIN TRANSACTION;

-- Create trigger function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table indexes
CREATE INDEX user_id_index ON users(id);

-- Users table trigger
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Book Statuses table
CREATE TABLE book_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Book Statuses table indexes
CREATE INDEX book_status_id_index ON book_statuses(id);

-- Book Statuses table trigger
CREATE TRIGGER update_book_statuses_updated_at
BEFORE UPDATE ON book_statuses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Authors table
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Authors table indexes
CREATE INDEX author_id_index ON authors(id);

-- Authors table trigger
CREATE TRIGGER update_authors_updated_at
BEFORE UPDATE ON authors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Publishers table
CREATE TABLE publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Publishers table indexes
CREATE INDEX publisher_id_index ON publishers(id);

-- Publishers table trigger
CREATE TRIGGER update_publishers_updated_at
BEFORE UPDATE ON publishers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  cover TEXT,
  publish_at TIMESTAMP NOT NULL,
  status_id UUID NOT NULL,
  publisher_id UUID NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (status_id) REFERENCES book_statuses(id),
  FOREIGN KEY (publisher_id) REFERENCES publishers(id),
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

-- Books table indexes
CREATE INDEX book_id_index ON books(id);
CREATE INDEX book_title_index ON books(title);
CREATE INDEX book_status_id_index ON books(status_id);
CREATE INDEX book_publisher_id_index ON books(publisher_id);
CREATE INDEX book_author_id_index ON books(author_id);

-- Books table trigger
CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON books
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Auto Tags table
CREATE TABLE auto_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto Tags table indexes
CREATE INDEX auto_tag_id_index ON auto_tags(id);
CREATE INDEX auto_tag_name_index ON auto_tags(name);

-- Auto Tags table trigger
CREATE TRIGGER update_auto_tags_updated_at
BEFORE UPDATE ON auto_tags
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Manual Tags table
CREATE TABLE manual_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual Tags table indexes
CREATE INDEX manual_tag_id_index ON manual_tags(id);
CREATE INDEX manual_tag_name_index ON manual_tags(name);

-- Manual Tags table trigger
CREATE TRIGGER update_manual_tags_updated_at
BEFORE UPDATE ON manual_tags
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Books to Auto Tags association table
CREATE TABLE books_auto_tags (
  book_id UUID NOT NULL,
  auto_tag_id UUID NOT NULL,
  PRIMARY KEY (book_id, auto_tag_id),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (auto_tag_id) REFERENCES auto_tags(id)
);

-- Create Books to Manual Tags association table
CREATE TABLE books_manual_tags (
  book_id UUID NOT NULL,
  manual_tag_id UUID NOT NULL,
  PRIMARY KEY (book_id, manual_tag_id),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (manual_tag_id) REFERENCES manual_tags(id)
);

-- Create Ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating INT NOT NULL,
  book_id UUID NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Ratings table indexes
CREATE INDEX rating_id_index ON ratings(id);
CREATE INDEX rating_book_id_index ON ratings(book_id);
CREATE INDEX rating_author_id_index ON ratings(author_id);

-- Ratings table trigger
CREATE TRIGGER update_ratings_updated_at
BEFORE UPDATE ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  book_id UUID NOT NULL,
  author_id UUID NOT NULL,
  parent_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

-- Comments table indexes
CREATE INDEX comment_id_index ON comments(id);
CREATE INDEX comment_book_id_index ON comments(book_id);
CREATE INDEX comment_author_id_index ON comments(author_id);
CREATE INDEX comment_parent_id_index ON comments(parent_id);

-- Comments table trigger
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Commit transaction
COMMIT TRANSACTION;