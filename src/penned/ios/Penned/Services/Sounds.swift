import AVFoundation
import SwiftUI

/// Short UI sounds, synthesised for Penned by ios/scripts/make_sounds.py (no third-party samples).
/// They follow the ring/silent switch, mix with music instead of interrupting it,
/// and can be turned off in Account → Sound effects.
@MainActor
final class Sounds {
    static let shared = Sounds()

    enum Effect: String, CaseIterable {
        case tap       // a soft click: tiles, the Track pill
        case step      // a paper flick: next step in an order
        case success   // two bright notes: order placed, paid, signed in
        case error     // a low double thud: something needs fixing
        case scribble  // a pen on paper: handwriting sample uploaded
    }

    /// Stored with @AppStorage("soundEffects") in Account.
    nonisolated static let settingKey = "soundEffects"

    private var players: [Effect: AVAudioPlayer] = [:]

    private init() {
        // .ambient respects the silent switch and mixes with other audio.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        for effect in Effect.allCases {
            let url = Bundle.main.url(forResource: effect.rawValue, withExtension: "wav")
                ?? Bundle.main.url(forResource: effect.rawValue, withExtension: "wav", subdirectory: "Sounds")
            guard let url, let player = try? AVAudioPlayer(contentsOf: url) else {
                print("[Penned] sound missing: \(effect.rawValue).wav")
                continue
            }
            player.prepareToPlay()
            players[effect] = player
        }
    }

    private var enabled: Bool {
        UserDefaults.standard.object(forKey: Self.settingKey) as? Bool ?? true
    }

    func play(_ effect: Effect) {
        guard enabled, let player = players[effect] else { return }
        player.currentTime = 0
        player.play()
    }

    /// Call once at launch so the first sound doesn't lag.
    static func warmUp() { _ = shared }
}
