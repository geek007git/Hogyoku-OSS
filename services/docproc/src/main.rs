use anyhow::{bail, Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{env, fs, path::PathBuf};

const TARGET_BYTES: usize = 1_200;
const OVERLAP_SENTENCES: usize = 2;

#[derive(Debug, Serialize)]
struct Chunk {
    id: String,
    page_number: u32,
    ordinal: usize,
    content_hash: String,
    content: String,
}

fn main() -> Result<()> {
    let options = Options::from_env()?;
    let input = fs::read_to_string(&options.input)
        .with_context(|| format!("failed to read {}", options.input.display()))?;
    let chunks = chunk_text(&input, options.page_number);
    serde_json::to_writer_pretty(std::io::stdout(), &chunks)?;
    println!();
    Ok(())
}

#[derive(Debug)]
struct Options {
    input: PathBuf,
    page_number: u32,
}

impl Options {
    fn from_env() -> Result<Self> {
        let mut args = env::args().skip(1);
        let input = args.next().map(PathBuf::from).unwrap_or_else(|| {
            eprintln!("usage: hogyoku-docproc <input.txt> [page_number]");
            std::process::exit(2);
        });
        let page_number = match args.next() {
            Some(value) => value
                .parse::<u32>()
                .with_context(|| format!("invalid page number: {value}"))?,
            None => 1,
        };
        if args.next().is_some() {
            bail!("too many arguments");
        }
        Ok(Self { input, page_number })
    }
}

fn chunk_text(input: &str, page_number: u32) -> Vec<Chunk> {
    let sentences = split_sentences(input);
    let mut chunks = Vec::new();
    let mut current: Vec<String> = Vec::new();

    for sentence in sentences {
        let candidate_size = current.iter().map(String::len).sum::<usize>() + sentence.len();
        if candidate_size > TARGET_BYTES && !current.is_empty() {
            push_chunk(&mut chunks, &current, page_number);
            let keep_from = current.len().saturating_sub(OVERLAP_SENTENCES);
            current = current[keep_from..].to_vec();
        }
        current.push(sentence);
    }

    if !current.is_empty() {
        push_chunk(&mut chunks, &current, page_number);
    }
    chunks
}

fn split_sentences(input: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    for character in input.chars() {
        current.push(character);
        if matches!(character, '.' | '!' | '?' | '\n') {
            let trimmed = current.split_whitespace().collect::<Vec<_>>().join(" ");
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current.clear();
        }
    }
    let trimmed = current.split_whitespace().collect::<Vec<_>>().join(" ");
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }
    sentences
}

fn push_chunk(chunks: &mut Vec<Chunk>, sentences: &[String], page_number: u32) {
    let content = sentences.join(" ");
    let hash = Sha256::digest(content.as_bytes());
    let content_hash = format!("{hash:x}");
    let ordinal = chunks.len();
    let short_hash = &content_hash[..12];
    chunks.push(Chunk {
        id: format!("page-{page_number}-chunk-{ordinal}-{short_hash}"),
        page_number,
        ordinal,
        content_hash,
        content,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunks_short_text() {
        let chunks = chunk_text("Alpha evidence. Beta evidence.", 7);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].page_number, 7);
        assert!(chunks[0].content.contains("Alpha evidence."));
    }

    #[test]
    fn chunks_long_text_with_stable_ordinals() {
        let text = "Evidence supports the claim. ".repeat(100);
        let chunks = chunk_text(&text, 1);
        assert!(chunks.len() > 1);
        for (index, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.ordinal, index);
            assert_eq!(chunk.content_hash.len(), 64);
        }
    }
}
