use mongodb::{options::ClientOptions, Client, Database};
use std::env;

pub async fn connect() -> anyhow::Result<Database> {
    let mongodb_uri = env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017/studybuddy".to_string());

    tracing::info!("Connecting to MongoDB...");
    let mut client_options = ClientOptions::parse(&mongodb_uri).await?;

    client_options.app_name = Some("StudyBuddy".to_string());

    let client = Client::with_options(client_options)?;

    let db = client
        .default_database()
        .unwrap_or_else(|| client.database("studybuddy"));

    // Ping the server to see if you can connect to the cluster
    client
        .database("admin")
        .run_command(mongodb::bson::doc! {"ping": 1})
        .await?;
    tracing::info!("✅ MongoDB connected and ready");

    Ok(db)
}
