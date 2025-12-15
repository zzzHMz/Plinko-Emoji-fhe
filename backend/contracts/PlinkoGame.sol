// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Plinko Emoji Game Contract
/// @author Plinko Emoji Team
/// @notice A Plinko game using FHE for encrypted score computation with daily check-ins and purchasable turns
contract PlinkoGame is ZamaEthereumConfig {
    // Constants
    uint256 public constant TURN_PRICE = 0.001 ether;
    uint256 public constant DAILY_FREE_TURNS = 3;
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    // Player data structure
    struct Player {
        euint32 totalScore;        // Total encrypted score
        uint256 lastCheckInTime;   // Last daily check-in timestamp
        uint256 availableTurns;    // Available turns to play
        uint256 gamesPlayed;       // Total games played
    }
    
    // Leaderboard entry (for public display)
    struct LeaderboardEntry {
        address playerAddress;
        uint256 gamesPlayed;
    }
    
    // State variables
    mapping(address => Player) public players;
    address[] public playerAddresses;
    address public owner;
    
    // Events
    event CheckedIn(address indexed player, uint256 turnsGranted, uint256 timestamp);
    event TurnsPurchased(address indexed player, uint256 turnsBought, uint256 amountPaid);
    event GamePlayed(address indexed player, uint256 turnsRemaining);
    event ScoreUpdated(address indexed player, uint256 gamesPlayed);
    event Withdrawal(address indexed owner, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /// @notice Perform daily check-in to receive free turns
    /// @dev Players can check in once per day to receive DAILY_FREE_TURNS
    function dailyCheckIn() external {
        Player storage player = players[msg.sender];
        
        // Check if player can check in (24 hours must have passed)
        require(
            block.timestamp >= player.lastCheckInTime + SECONDS_PER_DAY,
            "Already checked in today"
        );
        
        // First time player - add to player list
        if (player.lastCheckInTime == 0) {
            playerAddresses.push(msg.sender);
        }
        
        // Grant free turns
        player.availableTurns += DAILY_FREE_TURNS;
        player.lastCheckInTime = block.timestamp;
        
        emit CheckedIn(msg.sender, DAILY_FREE_TURNS, block.timestamp);
    }
    
    /// @notice Purchase additional turns with ETH
    /// @param turnCount Number of turns to purchase
    function buyTurns(uint256 turnCount) external payable {
        require(turnCount > 0, "Must buy at least 1 turn");
        require(msg.value == turnCount * TURN_PRICE, "Incorrect payment amount");
        
        Player storage player = players[msg.sender];
        
        // First time player - add to player list
        if (player.lastCheckInTime == 0) {
            playerAddresses.push(msg.sender);
            player.lastCheckInTime = 1; // Mark as initialized
        }
        
        player.availableTurns += turnCount;
        
        emit TurnsPurchased(msg.sender, turnCount, msg.value);
    }
    
    /// @notice Drop a ball and record the encrypted score
    /// @param encryptedScore External encrypted score from the game
    /// @param inputProof Zero-knowledge proof for the encrypted score
    /// @dev This function validates the ZK proof and adds the score to player's total
    function dropBall(externalEuint32 encryptedScore, bytes calldata inputProof) external {
        Player storage player = players[msg.sender];
        
        require(player.availableTurns > 0, "No turns available");
        
        // Convert external encrypted value to internal encrypted value
        euint32 score = FHE.fromExternal(encryptedScore, inputProof);
        
        // Add score to player's total
        player.totalScore = FHE.add(player.totalScore, score);
        
        // Decrement available turns
        player.availableTurns--;
        player.gamesPlayed++;
        
        // Grant FHE permissions
        FHE.allowThis(player.totalScore);
        FHE.allow(player.totalScore, msg.sender);
        
        emit GamePlayed(msg.sender, player.availableTurns);
        emit ScoreUpdated(msg.sender, player.gamesPlayed);
    }
    
    /// @notice Play a turn (simple version without FHE score)
    /// @dev Deducts 1 turn and increments games played
    function playTurn() external {
        Player storage player = players[msg.sender];
        
        require(player.availableTurns > 0, "No turns available");
        
        // Decrement available turns
        player.availableTurns--;
        player.gamesPlayed++;
        
        emit GamePlayed(msg.sender, player.availableTurns);
        emit ScoreUpdated(msg.sender, player.gamesPlayed);
    }
    
    /// @notice Get player's encrypted total score
    /// @param playerAddress Address of the player
    /// @return The encrypted total score
    function getPlayerScore(address playerAddress) external view returns (euint32) {
        return players[playerAddress].totalScore;
    }
    
    /// @notice Get player's public information
    /// @param playerAddress Address of the player
    /// @return lastCheckInTime Last check-in timestamp
    /// @return availableTurns Available turns
    /// @return gamesPlayed Total games played
    function getPlayerInfo(address playerAddress) 
        external 
        view 
        returns (
            uint256 lastCheckInTime,
            uint256 availableTurns,
            uint256 gamesPlayed
        ) 
    {
        Player storage player = players[playerAddress];
        return (
            player.lastCheckInTime,
            player.availableTurns,
            player.gamesPlayed
        );
    }
    
    /// @notice Get leaderboard sorted by games played
    /// @return Array of leaderboard entries
    function getLeaderboard() external view returns (LeaderboardEntry[] memory) {
        uint256 playerCount = playerAddresses.length;
        LeaderboardEntry[] memory leaderboard = new LeaderboardEntry[](playerCount);
        
        // Create leaderboard entries
        for (uint256 i = 0; i < playerCount; i++) {
            address playerAddr = playerAddresses[i];
            leaderboard[i] = LeaderboardEntry({
                playerAddress: playerAddr,
                gamesPlayed: players[playerAddr].gamesPlayed
            });
        }
        
        // Simple bubble sort (for small arrays)
        // In production, consider off-chain sorting for large datasets
        for (uint256 i = 0; i < playerCount; i++) {
            for (uint256 j = i + 1; j < playerCount; j++) {
                if (leaderboard[i].gamesPlayed < leaderboard[j].gamesPlayed) {
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
        
        return leaderboard;
    }
    
    /// @notice Get total number of players
    /// @return Total player count
    function getTotalPlayers() external view returns (uint256) {
        return playerAddresses.length;
    }
    
    /// @notice Check if player can check in today
    /// @param playerAddress Address of the player
    /// @return True if player can check in
    function canCheckIn(address playerAddress) external view returns (bool) {
        Player storage player = players[playerAddress];
        return block.timestamp >= player.lastCheckInTime + SECONDS_PER_DAY;
    }
    
    /// @notice Withdraw contract balance (owner only)
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        payable(owner).transfer(balance);
        emit Withdrawal(owner, balance);
    }
    
    /// @notice Get contract balance
    /// @return Current contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /// @notice Transfer ownership (owner only)
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        owner = newOwner;
    }
}
